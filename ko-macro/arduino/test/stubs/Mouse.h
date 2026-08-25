// Arduino Mouse kütüphanesinin test taklidi.
#pragma once

#include <string>
#include <vector>

#define MOUSE_LEFT 1
#define MOUSE_RIGHT 2
#define MOUSE_MIDDLE 4

struct MouseEvent {
  std::string action;  // press | release | move
  int value;
  int dx;
  int dy;
};

class FakeMouse {
 public:
  std::vector<MouseEvent> events;

  void begin() {}
  void press(char button) { events.push_back({"press", button, 0, 0}); }
  void release(char button) { events.push_back({"release", button, 0, 0}); }
  void move(signed char dx, signed char dy, signed char) {
    events.push_back({"move", 0, dx, dy});
  }
  void reset() { events.clear(); }
};

extern FakeMouse Mouse;
