// Firmware'i PC'de derleyip test edebilmek için Arduino çekirdeğinin
// minimum taklidi. Donanım yok: zaman sahte, seri port bellekte.
#pragma once

#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

typedef uint8_t byte;

#define LED_BUILTIN 13
#define OUTPUT 1
#define HIGH 1
#define LOW 0
#define F(x) (x)

// -- sahte saat ---------------------------------------------------------------

extern unsigned long fakeMillis;
inline unsigned long millis() { return fakeMillis; }
inline void delay(unsigned long ms) { fakeMillis += ms; }

// -- pin --------------------------------------------------------------------

extern int ledState;
inline void pinMode(int, int) {}
inline void digitalWrite(int pin, int value) {
  if (pin == LED_BUILTIN) ledState = value;
}

// Arduino'da constrain bir makrodur; karışık tiplerle çalışabilmesi için
// burada da makro olarak tanımlıyoruz.
#define constrain(value, low, high) \
  ((value) < (low) ? (low) : ((value) > (high) ? (high) : (value)))

// -- sahte seri port ----------------------------------------------------------

class FakeSerial {
 public:
  std::string input;    // cihaza gelen baytlar
  std::string output;   // cihazın yazdıkları
  size_t readPos = 0;
  bool connected = true;

  void begin(long) {}
  explicit operator bool() const { return connected; }

  int available() { return static_cast<int>(input.size() - readPos); }
  int read() { return readPos < input.size() ? input[readPos++] : -1; }

  void print(const char *text) { output += text; }
  void print(int value) { output += std::to_string(value); }
  void println(const char *text) { output += text; output += "\n"; }
  void println(int value) { output += std::to_string(value); output += "\n"; }

  // Test yardımcıları
  void feed(const std::string &line) { input += line; }
  void reset() { input.clear(); output.clear(); readPos = 0; }
  std::vector<std::string> lines() const {
    std::vector<std::string> result;
    std::string current;
    for (char c : output) {
      if (c == '\n') { result.push_back(current); current.clear(); }
      else current += c;
    }
    if (!current.empty()) result.push_back(current);
    return result;
  }
};

extern FakeSerial Serial;
