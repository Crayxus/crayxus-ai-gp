// EI TOKEN 案例 · 姿态检测
// MPU6050 算出板子的俯仰和横滚角
// 适用：Arduino Uno / Arduino Nano / ESP32 DevKit / ESP32-S3 DevKitC

#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

Adafruit_MPU6050 mpu;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  if (!mpu.begin()) { Serial.println("MPU6050 not found, check I2C wiring"); while (true) delay(1000); }
  Serial.println("EIT mpu6050 ready");
}

void loop() {
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  float pitch = atan2(-a.acceleration.x, sqrt(a.acceleration.y * a.acceleration.y + a.acceleration.z * a.acceleration.z)) * 57.3;
  float roll  = atan2(a.acceleration.y, a.acceleration.z) * 57.3;
  Serial.print("pitch "); Serial.print(pitch, 1); Serial.print("  roll "); Serial.println(roll, 1);
  delay(200);
}
