// EI TOKEN 案例 · 步进电机精准转一圈
// 28BYJ-48 转整整一圈，再倒回来
// 适用：Arduino Uno / Arduino Nano / ESP32 DevKit / ESP32-S3 DevKitC

#if defined(CONFIG_IDF_TARGET_ESP32S3)
const int IN1 = 17;
const int IN2 = 18;
const int IN3 = 38;
const int IN4 = 39;
#elif defined(ESP32)
const int IN1 = 25;
const int IN2 = 26;
const int IN3 = 27;
const int IN4 = 14;
#else
const int IN1 = 8;
const int IN2 = 9;
const int IN3 = 10;
const int IN4 = 11;
#endif

#include <Stepper.h>

const int STEPS_PER_REV = 2048;
Stepper motor(STEPS_PER_REV, IN1, IN3, IN2, IN4);   // 28BYJ-48 的线序是 1-3-2-4

void setup() {
  Serial.begin(115200);
  motor.setSpeed(12);   // 转/分钟，28BYJ-48 别超过 15
  Serial.println("EIT stepper-28byj ready");
}

void loop() {
  motor.step(STEPS_PER_REV);  Serial.println("turned +1 rev"); delay(800);
  motor.step(-STEPS_PER_REV); Serial.println("turned -1 rev"); delay(800);
}
