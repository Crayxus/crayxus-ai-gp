// EI TOKEN 案例 · 超声波测距
// HC-SR04 测出前方障碍有多远
// 适用：Arduino Uno / Arduino Nano / ESP32 DevKit / ESP32-S3 DevKitC

#if defined(CONFIG_IDF_TARGET_ESP32S3)
const int TRIG_PIN = 18;
const int ECHO_PIN = 38;
#elif defined(ESP32)
const int TRIG_PIN = 26;
const int ECHO_PIN = 27;
#else
const int TRIG_PIN = 9;
const int ECHO_PIN = 10;
#endif

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  Serial.println("EIT ultrasonic ready");
}

void loop() {
  digitalWrite(TRIG_PIN, LOW);  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);   // 10 微秒触发脉冲
  digitalWrite(TRIG_PIN, LOW);
  long us = pulseIn(ECHO_PIN, HIGH, 30000UL);            // 超时 30ms ≈ 5 米
  if (us == 0) { Serial.println("out of range"); }
  else { Serial.print(us * 0.0343 / 2, 1); Serial.println(" cm"); }
  delay(200);
}
