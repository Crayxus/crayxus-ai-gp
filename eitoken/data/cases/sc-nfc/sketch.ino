// EI TOKEN 案例 · 刷卡变身
// 机身里是一颗全功能 NFC（ST25R3916），贴一张卡就换一套人设
// 适用：M5 StackChan（CoreS3）

#include <Arduino.h>
#include <M5StackChan.h>
#include <M5UnitUnified.h>
#include <M5UnitUnifiedNFC.h>
#include <Avatar.h>
#include <string>
#include <vector>

using namespace m5avatar;
using namespace m5::nfc::a;

namespace {
m5::unit::UnitUnified Units;
m5::unit::UnitNFC nfc_unit{};
m5::nfc::NFCLayerA nfc_a{nfc_unit};
}  // namespace

Avatar avatar;

// 一套人设 = 表情 + 灯色 + 一个招牌动作（角度单位 0.1°）
struct Persona_t {
  const char *nm;
  Expression exp;
  uint8_t r, g, b;
  int yaw, pitch;
};

static const Persona_t kPersonas[] = {
  {"元气",   Expression::Happy,   170, 110, 0,   0,   800},
  {"高冷",   Expression::Neutral, 0,   80,  160, 400, 450},
  {"暴躁",   Expression::Angry,   170, 0,   0,  -450, 300},
  {"犯困",   Expression::Sleepy,  90,  0,   150, 0,   120},
  {"好奇",   Expression::Doubt,   0,   150, 90,  300, 700},
};
static const int kPersonaCount = sizeof(kPersonas) / sizeof(kPersonas[0]);

// 把卡号折成一个小数字，同一张卡永远对同一套人设
int uidToPersona(const std::string &uid) {
  uint32_t h = 2166136261u;
  for (char c : uid) { h = (h ^ (uint8_t)c) * 16777619u; }
  return h % kPersonaCount;
}

static std::string last_uid = "";

void applyPersona(const Persona_t &p) {
  avatar.setExpression(p.exp);
  avatar.setSpeechText(p.nm);
  M5StackChan.showRgbColor(p.r, p.g, p.b);
  M5StackChan.Motion.move(p.yaw, p.pitch, 700);
  Serial.printf("persona %s\n", p.nm);
}

void setup() {
  Serial.begin(115200);
  M5StackChan.begin();

  avatar.setSpeechFont(&fonts::efontCN_16);
  avatar.init();
  avatar.setIsAutoBlink(true);
  avatar.setSpeechText("刷张卡试试");

  M5StackChan.Motion.goHome(500);
  delay(600);
  M5StackChan.Motion.move(0, 450, 500);

  // NFC 挂在机内 I2C 上，用 M5UnitUnified 统一管
  if (!Units.add(nfc_unit, M5.In_I2C) || !Units.begin()) {
    Serial.println("nfc init failed");
    M5StackChan.showRgbColor(150, 0, 0);
    avatar.setExpression(Expression::Sad);
    avatar.setSpeechText("NFC 没起来");
  }

  Serial.println("EIT sc-nfc ready");
}

void loop() {
  M5StackChan.update();
  Units.update();

  std::vector<PICC> piccs;
  if (nfc_a.detect(piccs)) {
    for (auto &&p : piccs) {
      std::string uid = p.uidAsString();
      if (uid.empty() || uid == last_uid) continue;   // 同一张卡贴着不放只算一次
      last_uid = uid;
      Serial.printf("card %s type=%s\n", uid.c_str(), p.typeAsString().c_str());
      M5.Speaker.tone(4000, 60);
      applyPersona(kPersonas[uidToPersona(uid)]);
    }
    nfc_a.deactivate();
  } else if (!last_uid.empty()) {
    // 卡拿走了，允许下一次同卡再触发
    last_uid = "";
    Serial.println("card removed");
  }

  delay(100);
}
