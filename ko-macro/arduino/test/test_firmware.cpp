// Firmware'in PC üzerinde çalıştırılan testi.
//
// Arduino çekirdeği stubs/ altındaki taklitlerle değiştirilir, .ino doğrudan
// dahil edilir. Böylece protokol ayrıştırıcısı, combo kuyruğu, iptal ve
// watchdog davranışı donanım olmadan doğrulanabilir.
//
// Derle ve çalıştır:  ./run_tests.sh

#include "stubs/Arduino.h"
#include "stubs/Keyboard.h"
#include "stubs/Mouse.h"

#include <iostream>
#include <string>
#include <vector>

// Stub'ların global örnekleri.
unsigned long fakeMillis = 0;
int ledState = LOW;
FakeSerial Serial;
FakeKeyboard Keyboard;
FakeMouse Mouse;

void FakeKeyboard::press(uint8_t code) {
  events.push_back({"press", code, fakeMillis});
  heldCount++;
}
void FakeKeyboard::release(uint8_t code) {
  events.push_back({"release", code, fakeMillis});
  if (heldCount > 0) heldCount--;
}
void FakeKeyboard::releaseAll() {
  events.push_back({"releaseAll", 0, fakeMillis});
  heldCount = 0;
}

#include "../ko_hid_bridge/ko_hid_bridge.ino"

// ---------------------------------------------------------------- test altyapısı

static int failures = 0;
static int checks = 0;

static void check(bool condition, const std::string &label) {
  checks++;
  if (!condition) {
    failures++;
    std::cout << "  BAŞARISIZ: " << label << "\n";
  }
}

template <typename A, typename B>
static void checkEqual(const A &actual, const B &expected, const std::string &label) {
  checks++;
  if (!(actual == expected)) {
    failures++;
    std::cout << "  BAŞARISIZ: " << label << "\n"
              << "    beklenen: " << expected << "\n"
              << "    gelen   : " << actual << "\n";
  }
}

static void resetAll() {
  Serial.reset();
  Keyboard.reset();
  Mouse.reset();
  fakeMillis = 1000;
  ledState = LOW;
  stepCount = 0;
  armed = false;
  heldKeyCount = 0;
  lineLen = 0;
  for (int i = 0; i < 3; i++) heldMouse[i] = false;
  lastCommandMs = fakeMillis;
}

// Bir ya da birden fazla satırı cihaza gönderir ve loop()'u çalıştırır.
static void send(const std::string &lines) {
  Serial.feed(lines);
  loop();
}

static std::string lastLine() {
  auto lines = Serial.lines();
  return lines.empty() ? "" : lines.back();
}

static void arm() {
  send("E\n");
  Serial.reset();
}

// ------------------------------------------------------------------- testler

static void test_version_and_ping() {
  resetAll();
  send("V\n");
  checkEqual(lastLine(), std::string("VER ko-hid 1.0"), "V sürüm döndürür");

  Serial.reset();
  send("P\n");
  checkEqual(lastLine(), std::string("PONG"), "P heartbeat döndürür");
}

static void test_disarmed_blocks_input() {
  resetAll();
  send("T f1 40\n");
  checkEqual(lastLine(), std::string("ERR disarmed"), "kapalıyken tuş gönderilmez");
  checkEqual((int)Keyboard.events.size(), 0, "kapalıyken hiç HID olayı yok");
}

static void test_arm_lights_led() {
  resetAll();
  send("E\n");
  checkEqual(lastLine(), std::string("ARMED"), "E cevabı");
  checkEqual(ledState, HIGH, "ARMED iken LED yanar");

  Serial.reset();
  send("X\n");
  checkEqual(lastLine(), std::string("DISARMED"), "X cevabı");
  checkEqual(ledState, LOW, "DISARMED iken LED söner");
}

static void test_tap_presses_and_releases() {
  resetAll();
  arm();
  send("T f1 40\n");

  checkEqual(lastLine(), std::string("OK"), "T cevabı");
  checkEqual((int)Keyboard.events.size(), 2, "tap iki olay üretir");
  checkEqual(Keyboard.events[0].action, std::string("press"), "önce press");
  checkEqual((int)Keyboard.events[0].code, (int)KEY_F1, "doğru tuş kodu");
  checkEqual(Keyboard.events[1].action, std::string("release"), "sonra release");
  checkEqual(Keyboard.events[1].at - Keyboard.events[0].at, 40UL, "hold süresi 40 ms");
}

static void test_single_char_keys() {
  resetAll();
  arm();
  send("T a\n");
  checkEqual((int)Keyboard.events[0].code, (int)'a', "tek harf ASCII olarak gider");

  Keyboard.reset();
  send("T 5\n");
  checkEqual((int)Keyboard.events[0].code, (int)'5', "rakam ASCII olarak gider");
}

static void test_unknown_key_rejected() {
  resetAll();
  arm();
  send("T gitar\n");
  checkEqual(lastLine(), std::string("ERR unknown key"), "bilinmeyen tuş reddedilir");
  checkEqual((int)Keyboard.events.size(), 0, "reddedilen tuş basılmaz");
}

static void test_hold_and_release_tracking() {
  resetAll();
  arm();
  send("D lshift\n");
  send("D f1\n");
  checkEqual((int)heldKeyCount, 2, "iki tuş basılı takip edilir");

  send("R\n");
  checkEqual((int)heldKeyCount, 0, "R hepsini bırakır");
  checkEqual(Keyboard.heldCount, 0, "klavye tarafında da bırakıldı");
}

static void test_mouse_click() {
  resetAll();
  arm();
  send("C right 60\n");
  checkEqual((int)Mouse.events.size(), 2, "tıklama iki olay");
  checkEqual(Mouse.events[0].value, (int)MOUSE_RIGHT, "sağ tuş");
}

static void test_mouse_move_is_chunked() {
  resetAll();
  arm();
  send("MV 300 -200\n");
  // 300 -> 127 + 127 + 46 => en az 3 olay
  check(Mouse.events.size() >= 3, "büyük hareket parçalara bölünür");
  int totalX = 0, totalY = 0;
  for (const auto &event : Mouse.events) { totalX += event.dx; totalY += event.dy; }
  checkEqual(totalX, 300, "toplam yatay hareket korunur");
  checkEqual(totalY, -200, "toplam dikey hareket korunur");
}

static void test_queue_runs_in_order() {
  resetAll();
  arm();
  send("QC\n");
  send("QK 1 40 100\n");
  send("QK 2 40 0\n");
  Serial.reset();
  Keyboard.reset();
  send("G 2\n");

  checkEqual(lastLine(), std::string("DONE 4"), "iki tur, dört adım");
  checkEqual((int)Keyboard.events.size(), 8, "her adım press+release");
  checkEqual((int)Keyboard.events[0].code, (int)'1', "ilk adım");
  checkEqual((int)Keyboard.events[2].code, (int)'2', "ikinci adım");
  checkEqual((int)Keyboard.events[4].code, (int)'1', "ikinci turda baştan");
}

static void test_queue_timing_uses_gaps() {
  resetAll();
  arm();
  send("QC\n");
  send("QK 1 40 100\n");
  send("QK 2 40 0\n");
  Keyboard.reset();
  unsigned long start = fakeMillis;
  send("G 1\n");
  // 40 ms hold + 100 ms gap + 40 ms hold = 180 ms
  checkEqual(fakeMillis - start, 180UL, "kuyruk süresi hold+gap toplamı");
}

static void test_queue_full_is_reported() {
  resetAll();
  arm();
  send("QC\n");
  for (int i = 0; i < MAX_STEPS; i++) send("QK 1 10 0\n");
  Serial.reset();
  send("QK 1 10 0\n");
  checkEqual(lastLine(), std::string("ERR queue full"), "kuyruk dolunca hata");
}

static void test_empty_queue_is_reported() {
  resetAll();
  arm();
  send("QC\n");
  Serial.reset();
  send("G 1\n");
  checkEqual(lastLine(), std::string("ERR queue empty"), "boş kuyruk çalıştırılmaz");
}

static void test_incoming_byte_aborts_combo() {
  resetAll();
  arm();
  send("QC\n");
  send("QK 1 40 500\n");
  send("QK 2 40 500\n");
  Serial.reset();
  Keyboard.reset();
  // "G 1" ile birlikte bir iptal baytı da gönderiliyor: ilk beklemede kesilmeli.
  send("G 1\nA\n");

  check(lastLine().rfind("ABORT", 0) == 0, "iptal bildirilir");
  check(Keyboard.events.size() < 4, "combo yarıda kesildi");
  checkEqual(Keyboard.heldCount, 0, "iptalde tuşlar bırakılır");
}

static void test_watchdog_disarms_after_silence() {
  resetAll();
  arm();
  checkEqual((int)armed, 1, "başlangıçta açık");

  fakeMillis += WATCHDOG_MS + 1;
  loop();
  checkEqual((int)armed, 0, "sessizlik sonrası kapanır");
  checkEqual(ledState, LOW, "watchdog LED'i söndürür");
}

static void test_heartbeat_keeps_armed() {
  resetAll();
  arm();
  for (int i = 0; i < 5; i++) {
    fakeMillis += WATCHDOG_MS / 2;
    send("P\n");
  }
  checkEqual((int)armed, 1, "heartbeat açık tutar");
}

static void test_serial_disconnect_disarms() {
  resetAll();
  arm();
  Serial.connected = false;
  loop();
  checkEqual((int)armed, 0, "bağlantı kopunca kapanır");
  Serial.connected = true;
}

static void test_long_line_is_rejected() {
  resetAll();
  arm();
  Serial.reset();
  send(std::string(80, 'x') + "\n");
  check(lastLine().rfind("ERR", 0) == 0, "uzun satır hata döndürür");
}

static void test_hold_is_clamped() {
  resetAll();
  arm();
  Keyboard.reset();
  send("T f1 99999\n");
  checkEqual(Keyboard.events[1].at - Keyboard.events[0].at, (unsigned long)MAX_HOLD_MS,
             "aşırı hold süresi kırpılır");
}

static void test_abort_when_idle_is_safe() {
  resetAll();
  arm();
  send("D f1\n");
  Serial.reset();
  send("A\n");
  checkEqual(lastLine(), std::string("ABORT"), "boştayken iptal onaylanır");
  checkEqual(Keyboard.heldCount, 0, "iptal basılı tuşları bırakır");
}

// ---------------------------------------------------------------------- main

int main() {
  setup();

  struct TestCase {
    const char *name;
    void (*run)();
  };

  const TestCase tests[] = {
      {"sürüm ve heartbeat", test_version_and_ping},
      {"kapalıyken giriş engellenir", test_disarmed_blocks_input},
      {"arm/disarm ve LED", test_arm_lights_led},
      {"tuşa basma", test_tap_presses_and_releases},
      {"tek karakterli tuşlar", test_single_char_keys},
      {"bilinmeyen tuş", test_unknown_key_rejected},
      {"basılı tuş takibi", test_hold_and_release_tracking},
      {"fare tıklama", test_mouse_click},
      {"fare hareketi parçalanır", test_mouse_move_is_chunked},
      {"kuyruk sırayla çalışır", test_queue_runs_in_order},
      {"kuyruk zamanlaması", test_queue_timing_uses_gaps},
      {"kuyruk dolu", test_queue_full_is_reported},
      {"kuyruk boş", test_empty_queue_is_reported},
      {"combo iptali", test_incoming_byte_aborts_combo},
      {"watchdog", test_watchdog_disarms_after_silence},
      {"heartbeat açık tutar", test_heartbeat_keeps_armed},
      {"bağlantı kopması", test_serial_disconnect_disarms},
      {"uzun satır", test_long_line_is_rejected},
      {"hold kırpma", test_hold_is_clamped},
      {"boşta iptal", test_abort_when_idle_is_safe},
  };

  for (const auto &test : tests) {
    int before = failures;
    test.run();
    std::cout << (failures == before ? "  ok   " : "  HATA ") << test.name << "\n";
  }

  std::cout << "\n" << checks << " kontrol, " << failures << " başarısız\n";
  return failures == 0 ? 0 : 1;
}
