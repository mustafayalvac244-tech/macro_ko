/*
 * ko_hid_bridge - Arduino Leonardo (ATmega32u4) USB HID köprüsü
 *
 * PC tarafı (python/ko_macro) seri porttan satır bazlı komut gönderir,
 * Leonardo bunları gerçek USB klavye/fare olayına çevirir.
 *
 * Protokol (115200 baud, '\n' ile biten ASCII satırlar):
 *
 *   V              -> "VER ko-hid 1.0"      sürüm sorgusu
 *   P              -> "PONG"                heartbeat / watchdog besleme
 *   E              -> "ARMED"               HID çıkışını aç
 *   X              -> "DISARMED"            HID çıkışını kapat + her şeyi bırak
 *   R              -> "RELEASED"            basılı kalan tüm tuş/butonları bırak
 *   T <key> [ms]   -> "OK"                  tuşa bas-bırak (varsayılan 45 ms)
 *   D <key>        -> "OK"                  tuşu basılı tut
 *   U <key>        -> "OK"                  tuşu bırak
 *   C <btn> [ms]   -> "OK"                  fare tıkla (left|right|middle)
 *   MD <btn>       -> "OK"                  fare butonunu basılı tut
 *   MU <btn>       -> "OK"                  fare butonunu bırak
 *   MV <dx> <dy>   -> "OK"                  fareyi göreli hareket ettir
 *
 * Combo kuyruğu (zamanlaması PC'ye değil, Leonardo'nun kendi saatine bağlı):
 *
 *   QC             -> "OK"                  kuyruğu temizle
 *   QK <key> <hold> <gap>  -> "OK"          kuyruğa bas-bırak adımı ekle
 *   QD <key> <gap>         -> "OK"          kuyruğa "basılı tut" adımı ekle
 *   QU <key> <gap>         -> "OK"          kuyruğa "bırak" adımı ekle
 *   QM <btn> <hold> <gap>  -> "OK"          kuyruğa fare adımı ekle
 *   G [tekrar]     -> "DONE <adım>"         kuyruğu çalıştır (varsayılan 1 kez)
 *   A              -> "ABORT"               çalışan comboyu kes
 *
 * Hata durumunda "ERR <sebep>" döner.
 *
 * Güvenlik:
 *   - Açılışta DISARMED; "E" gelene kadar tek bir HID olayı bile üretmez.
 *   - Watchdog: ARMED iken WATCHDOG_MS boyunca komut gelmezse her şeyi
 *     bırakıp DISARMED'a döner (PC çökerse tuş basılı kalmasın diye).
 *   - Seri port kapanınca (DTR düşünce) aynı şekilde temizlenir.
 */

#include <Keyboard.h>
#include <Mouse.h>

static const unsigned long WATCHDOG_MS = 2000;
static const unsigned int  DEFAULT_TAP_MS = 45;
static const unsigned int  MAX_HOLD_MS = 1000;
static const byte          MAX_TRACKED = 12;
static const byte          MAX_STEPS = 32;
static const unsigned int  MAX_GAP_MS = 5000;

// Arduino AVR core sürümleri arasında numpad kodları değişebiliyor.
#ifndef KEY_KP_0
#define KEY_KP_0 0xEA
#define KEY_KP_1 0xE1
#define KEY_KP_2 0xE2
#define KEY_KP_3 0xE3
#define KEY_KP_4 0xE4
#define KEY_KP_5 0xE5
#define KEY_KP_6 0xE6
#define KEY_KP_7 0xE7
#define KEY_KP_8 0xE8
#define KEY_KP_9 0xE9
#define KEY_KP_ENTER 0xE0
#define KEY_KP_PLUS 0xDF
#define KEY_KP_MINUS 0xDE
#endif

struct KeyEntry {
  const char *name;
  uint8_t code;
};

// Python tarafındaki ko_macro/keys.py ile birebir aynı isimler.
static const KeyEntry KEY_TABLE[] = {
  {"tab", KEY_TAB},          {"esc", KEY_ESC},          {"enter", KEY_RETURN},
  {"space", ' '},            {"backspace", KEY_BACKSPACE}, {"delete", KEY_DELETE},
  {"insert", KEY_INSERT},    {"home", KEY_HOME},        {"end", KEY_END},
  {"pageup", KEY_PAGE_UP},   {"pagedown", KEY_PAGE_DOWN},
  {"up", KEY_UP_ARROW},      {"down", KEY_DOWN_ARROW},
  {"left", KEY_LEFT_ARROW},  {"right", KEY_RIGHT_ARROW},
  {"lshift", KEY_LEFT_SHIFT},{"rshift", KEY_RIGHT_SHIFT},
  {"lctrl", KEY_LEFT_CTRL},  {"rctrl", KEY_RIGHT_CTRL},
  {"lalt", KEY_LEFT_ALT},    {"ralt", KEY_RIGHT_ALT},
  {"f1", KEY_F1},   {"f2", KEY_F2},   {"f3", KEY_F3},   {"f4", KEY_F4},
  {"f5", KEY_F5},   {"f6", KEY_F6},   {"f7", KEY_F7},   {"f8", KEY_F8},
  {"f9", KEY_F9},   {"f10", KEY_F10}, {"f11", KEY_F11}, {"f12", KEY_F12},
  {"numpad0", KEY_KP_0}, {"numpad1", KEY_KP_1}, {"numpad2", KEY_KP_2},
  {"numpad3", KEY_KP_3}, {"numpad4", KEY_KP_4}, {"numpad5", KEY_KP_5},
  {"numpad6", KEY_KP_6}, {"numpad7", KEY_KP_7}, {"numpad8", KEY_KP_8},
  {"numpad9", KEY_KP_9}, {"numpadenter", KEY_KP_ENTER},
  {"numpadplus", KEY_KP_PLUS}, {"numpadminus", KEY_KP_MINUS},
};
static const byte KEY_TABLE_LEN = sizeof(KEY_TABLE) / sizeof(KEY_TABLE[0]);

static bool armed = false;
static unsigned long lastCommandMs = 0;

// Basılı tutulan tuşlar - "R" ve watchdog bunları tek tek bırakabilsin diye.
static uint8_t heldKeys[MAX_TRACKED];
static byte heldKeyCount = 0;
static bool heldMouse[3] = {false, false, false};

static char lineBuf[48];
static byte lineLen = 0;

// Adım türleri. TAP bas-bırak; HOLD basılı bırakır, RELEASE bırakır.
// HOLD/RELEASE olmadan "yön tuşu basılıyken skill bas" gibi örtüşen
// girdiler ifade edilemiyor - koşarak atışın tamamı o örtüşmede.
#define STEP_TAP 0
#define STEP_HOLD 1
#define STEP_RELEASE 2

// Combo kuyruğu: adımlar önceden yüklenir, "G" ile tek seferde çalıştırılır.
struct Step {
  uint8_t isMouse;
  uint8_t action;  // STEP_TAP | STEP_HOLD | STEP_RELEASE
  uint8_t code;    // tuş kodu ya da MOUSE_* sabiti
  uint16_t hold;   // basılı tutma süresi (ms) - sadece TAP için
  uint16_t gap;    // adımdan sonra beklenecek süre (ms)
};

static Step stepQueue[MAX_STEPS];
static byte stepCount = 0;

// ---------------------------------------------------------------- yardımcılar

static void toLowerInPlace(char *s) {
  for (; *s; ++s) {
    if (*s >= 'A' && *s <= 'Z') *s += 32;
  }
}

// Tuş adını HID koduna çevirir. Tek karakterlik adlar (a-z, 0-9, ',' vb.)
// doğrudan ASCII kodu olarak gider.
static bool lookupKey(const char *name, uint8_t *out) {
  if (name == NULL || name[0] == '\0') return false;
  if (name[1] == '\0') {
    char c = name[0];
    if (c < 0x20 || c > 0x7E) return false;
    *out = (uint8_t)c;
    return true;
  }
  for (byte i = 0; i < KEY_TABLE_LEN; i++) {
    if (strcmp(name, KEY_TABLE[i].name) == 0) {
      *out = KEY_TABLE[i].code;
      return true;
    }
  }
  return false;
}

static bool lookupButton(const char *name, char *out) {
  if (strcmp(name, "left") == 0)   { *out = MOUSE_LEFT;   return true; }
  if (strcmp(name, "right") == 0)  { *out = MOUSE_RIGHT;  return true; }
  if (strcmp(name, "middle") == 0) { *out = MOUSE_MIDDLE; return true; }
  return false;
}

static byte buttonIndex(char btn) {
  if (btn == MOUSE_RIGHT) return 1;
  if (btn == MOUSE_MIDDLE) return 2;
  return 0;
}

static unsigned int clampHold(long ms) {
  if (ms <= 0) return DEFAULT_TAP_MS;
  if (ms > (long)MAX_HOLD_MS) return MAX_HOLD_MS;
  return (unsigned int)ms;
}

static void trackKey(uint8_t code) {
  for (byte i = 0; i < heldKeyCount; i++) {
    if (heldKeys[i] == code) return;
  }
  if (heldKeyCount < MAX_TRACKED) heldKeys[heldKeyCount++] = code;
}

static void untrackKey(uint8_t code) {
  for (byte i = 0; i < heldKeyCount; i++) {
    if (heldKeys[i] == code) {
      heldKeys[i] = heldKeys[heldKeyCount - 1];
      heldKeyCount--;
      return;
    }
  }
}

static void releaseAll() {
  for (byte i = 0; i < heldKeyCount; i++) Keyboard.release(heldKeys[i]);
  heldKeyCount = 0;
  Keyboard.releaseAll();
  const char buttons[3] = {MOUSE_LEFT, MOUSE_RIGHT, MOUSE_MIDDLE};
  for (byte i = 0; i < 3; i++) {
    if (heldMouse[i]) {
      Mouse.release(buttons[i]);
      heldMouse[i] = false;
    }
  }
}

static void disarm() {
  releaseAll();
  armed = false;
  digitalWrite(LED_BUILTIN, LOW);
}

// ------------------------------------------------------------- combo kuyruğu

static unsigned int clampGap(long ms) {
  if (ms <= 0) return 0;
  if (ms > (long)MAX_GAP_MS) return MAX_GAP_MS;
  return (unsigned int)ms;
}

static bool queueStep(bool isMouse, uint8_t action, uint8_t code, long hold, long gap) {
  if (stepCount >= MAX_STEPS) return false;
  stepQueue[stepCount].isMouse = isMouse ? 1 : 0;
  stepQueue[stepCount].action = action;
  stepQueue[stepCount].code = code;
  stepQueue[stepCount].hold = clampHold(hold);
  stepQueue[stepCount].gap = clampGap(gap);
  stepCount++;
  return true;
}

// Beklerken hem watchdog'u besler hem de iptal isteğini yakalar.
static bool waitOrAbort(unsigned int ms) {
  unsigned long start = millis();
  while ((millis() - start) < ms) {
    if (Serial.available() > 0) return false;  // gelen herhangi bir bayt = iptal
    delay(1);
  }
  lastCommandMs = millis();
  return true;
}

// Kuyruğu `repeat` kez çalıştırır. Kesilirse çalıştırılan adım sayısını
// negatif olarak döndürür.
static int runQueue(unsigned int repeat) {
  int executed = 0;
  for (unsigned int round = 0; round < repeat; round++) {
    for (byte i = 0; i < stepCount; i++) {
      const Step &step = stepQueue[i];

      if (step.action == STEP_RELEASE) {
        // Basılı tutulan tuşu bırak; bekleme sadece gap kadar.
        if (step.isMouse) {
          Mouse.release((char)step.code);
          heldMouse[buttonIndex((char)step.code)] = false;
        } else {
          Keyboard.release(step.code);
          untrackKey(step.code);
        }
        executed++;
        if (step.gap > 0 && !waitOrAbort(step.gap)) return -executed;
        continue;
      }

      if (step.isMouse) {
        Mouse.press((char)step.code);
        heldMouse[buttonIndex((char)step.code)] = true;
      } else {
        Keyboard.press(step.code);
        trackKey(step.code);
      }

      if (step.action == STEP_HOLD) {
        // Basılı bırakıyoruz: sıradaki adımlar bu tuş basılıyken çalışacak.
        executed++;
        if (step.gap > 0 && !waitOrAbort(step.gap)) return -executed;
        continue;
      }

      bool ok = waitOrAbort(step.hold);

      if (step.isMouse) {
        Mouse.release((char)step.code);
        heldMouse[buttonIndex((char)step.code)] = false;
      } else {
        Keyboard.release(step.code);
        untrackKey(step.code);
      }
      executed++;

      if (!ok) return -executed;
      if (step.gap > 0 && !waitOrAbort(step.gap)) return -executed;
    }
  }
  return executed;
}

// ------------------------------------------------------------ komut işleyicisi

// Satırı boşluklardan en fazla 3 parçaya böler.
static byte splitArgs(char *line, char *argv[], byte maxArgs) {
  byte argc = 0;
  char *p = line;
  while (*p && argc < maxArgs) {
    while (*p == ' ') p++;
    if (!*p) break;
    argv[argc++] = p;
    while (*p && *p != ' ') p++;
    if (*p) *p++ = '\0';
  }
  return argc;
}

static void handleLine(char *line) {
  char *argv[4];
  byte argc = splitArgs(line, argv, 4);
  if (argc == 0) return;

  toLowerInPlace(argv[0]);
  const char *cmd = argv[0];
  lastCommandMs = millis();

  if (strcmp(cmd, "v") == 0) { Serial.println(F("VER ko-hid 1.0")); return; }
  if (strcmp(cmd, "p") == 0) { Serial.println(F("PONG")); return; }
  if (strcmp(cmd, "e") == 0) {
    armed = true;
    digitalWrite(LED_BUILTIN, HIGH);
    Serial.println(F("ARMED"));
    return;
  }
  if (strcmp(cmd, "x") == 0) { disarm(); Serial.println(F("DISARMED")); return; }
  if (strcmp(cmd, "r") == 0) { releaseAll(); Serial.println(F("RELEASED")); return; }
  // "A" combo çalışırken gelirse waitOrAbort onu zaten yakalar; burada
  // sadece boştayken gelen iptali onaylıyoruz.
  if (strcmp(cmd, "a") == 0) { releaseAll(); Serial.println(F("ABORT")); return; }
  if (strcmp(cmd, "qc") == 0) { stepCount = 0; Serial.println(F("OK")); return; }

  if (!armed) { Serial.println(F("ERR disarmed")); return; }

  if (strcmp(cmd, "t") == 0 || strcmp(cmd, "d") == 0 || strcmp(cmd, "u") == 0) {
    if (argc < 2) { Serial.println(F("ERR missing key")); return; }
    toLowerInPlace(argv[1]);
    uint8_t code;
    if (!lookupKey(argv[1], &code)) { Serial.println(F("ERR unknown key")); return; }

    if (cmd[0] == 't') {
      unsigned int hold = clampHold(argc >= 3 ? atol(argv[2]) : 0);
      Keyboard.press(code);
      trackKey(code);
      delay(hold);
      Keyboard.release(code);
      untrackKey(code);
    } else if (cmd[0] == 'd') {
      Keyboard.press(code);
      trackKey(code);
    } else {
      Keyboard.release(code);
      untrackKey(code);
    }
    Serial.println(F("OK"));
    return;
  }

  if (strcmp(cmd, "c") == 0 || strcmp(cmd, "md") == 0 || strcmp(cmd, "mu") == 0) {
    if (argc < 2) { Serial.println(F("ERR missing button")); return; }
    toLowerInPlace(argv[1]);
    char btn;
    if (!lookupButton(argv[1], &btn)) { Serial.println(F("ERR unknown button")); return; }

    if (strcmp(cmd, "c") == 0) {
      unsigned int hold = clampHold(argc >= 3 ? atol(argv[2]) : 0);
      Mouse.press(btn);
      heldMouse[buttonIndex(btn)] = true;
      delay(hold);
      Mouse.release(btn);
      heldMouse[buttonIndex(btn)] = false;
    } else if (strcmp(cmd, "md") == 0) {
      Mouse.press(btn);
      heldMouse[buttonIndex(btn)] = true;
    } else {
      Mouse.release(btn);
      heldMouse[buttonIndex(btn)] = false;
    }
    Serial.println(F("OK"));
    return;
  }

  if (strcmp(cmd, "qk") == 0 || strcmp(cmd, "qm") == 0
      || strcmp(cmd, "qd") == 0 || strcmp(cmd, "qu") == 0) {
    if (argc < 2) { Serial.println(F("ERR missing target")); return; }
    toLowerInPlace(argv[1]);

    // QD/QU'da hold yok: ikinci sayı doğrudan gap.
    bool tapStep = (cmd[1] == 'k' || cmd[1] == 'm');
    long hold = tapStep && argc >= 3 ? atol(argv[2]) : 0;
    long gap;
    if (tapStep) {
      gap = argc >= 4 ? atol(argv[3]) : 0;
    } else {
      gap = argc >= 3 ? atol(argv[2]) : 0;
    }

    uint8_t action = STEP_TAP;
    if (cmd[1] == 'd') action = STEP_HOLD;
    else if (cmd[1] == 'u') action = STEP_RELEASE;

    bool isMouse = (cmd[1] == 'm');
    uint8_t code;
    if (isMouse) {
      char btn;
      if (!lookupButton(argv[1], &btn)) { Serial.println(F("ERR unknown button")); return; }
      code = (uint8_t)btn;
    } else {
      if (!lookupKey(argv[1], &code)) { Serial.println(F("ERR unknown key")); return; }
    }
    if (!queueStep(isMouse, action, code, hold, gap)) {
      Serial.println(F("ERR queue full"));
      return;
    }
    Serial.println(F("OK"));
    return;
  }

  if (strcmp(cmd, "g") == 0) {
    if (stepCount == 0) { Serial.println(F("ERR queue empty")); return; }
    long repeat = argc >= 2 ? atol(argv[1]) : 1;
    if (repeat < 1) repeat = 1;
    if (repeat > 999) repeat = 999;

    int executed = runQueue((unsigned int)repeat);
    lastCommandMs = millis();
    if (executed < 0) {
      releaseAll();
      // İptali tetikleyen baytı yut ki sonraki satırın başına karışmasın.
      while (Serial.available() > 0) Serial.read();
      Serial.print(F("ABORT "));
      Serial.println(-executed);
    } else {
      Serial.print(F("DONE "));
      Serial.println(executed);
    }
    return;
  }

  if (strcmp(cmd, "mv") == 0) {
    if (argc < 3) { Serial.println(F("ERR missing delta")); return; }
    long dx = atol(argv[1]);
    long dy = atol(argv[2]);
    // HID raporu tek seferde -127..127 taşıyabilir, büyük hareketi böl.
    while (dx != 0 || dy != 0) {
      signed char sx = (signed char)constrain(dx, -127, 127);
      signed char sy = (signed char)constrain(dy, -127, 127);
      Mouse.move(sx, sy, 0);
      dx -= sx;
      dy -= sy;
      if (dx != 0 || dy != 0) delay(4);
    }
    Serial.println(F("OK"));
    return;
  }

  Serial.println(F("ERR unknown command"));
}

// ------------------------------------------------------------------ ana döngü

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);
  Serial.begin(115200);
  Keyboard.begin();
  Mouse.begin();
  lastCommandMs = millis();
}

void loop() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      lineBuf[lineLen] = '\0';
      if (lineLen > 0) handleLine(lineBuf);
      lineLen = 0;
      continue;
    }
    if (lineLen < sizeof(lineBuf) - 1) {
      lineBuf[lineLen++] = c;
    } else {
      // Satır taştı: kalanı yut ve hata bildir.
      lineLen = 0;
      Serial.println(F("ERR line too long"));
    }
  }

  // PC bağlantısı koptuysa ya da uzun süre sessizse güvenli tarafa geç.
  if (armed) {
    if (!Serial || (millis() - lastCommandMs) > WATCHDOG_MS) {
      disarm();
      if (Serial) Serial.println(F("ERR watchdog"));
    }
  }
}
