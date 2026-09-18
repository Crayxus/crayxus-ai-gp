// EI TOKEN 案例 · 舵机来回摆
// SG90 舵机从 0° 转到 180° 再转回来
// 适用：Arduino Uno / Arduino Nano / ESP32 DevKit / ESP32-S3 DevKitC

#if defined(CONFIG_IDF_TARGET_ESP32S3)
const int SERVO_PIN = 18;
#elif defined(ESP32)
const int SERVO_PIN = 26;
#else
const int SERVO_PIN = 9;
#endif

#if defined(ESP32)
#include <ESP32Servo.h>   // ESP32 上标准 Servo 库用不了，换这个
#else
#include <Servo.h>
#endif

Servo servo;

void setup() {
  Serial.begin(115200);
  servo.attach(SERVO_PIN);
  Serial.println("EIT servo-sweep ready");
}

void loop() {
  for (int a = 0; a <= 180; a += 2) { servo.write(a); delay(15); }
  Serial.println("angle 180");
  for (int a = 180; a >= 0; a -= 2) { servo.write(a); delay(15); }
  Serial.println("angle 0");
}
