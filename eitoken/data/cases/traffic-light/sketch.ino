// EI TOKEN 案例 · 红绿灯
// 红黄绿三色轮流亮，做一个路口信号灯
// 适用：Arduino Uno / Arduino Nano / ESP32 DevKit / ESP32-S3 DevKitC

#if defined(CONFIG_IDF_TARGET_ESP32S3)
const int RED_PIN = 6;
const int YELLOW_PIN = 5;
const int GREEN_PIN = 4;
#elif defined(ESP32)
const int RED_PIN = 17;
const int YELLOW_PIN = 16;
const int GREEN_PIN = 4;
#else
const int RED_PIN = 4;
const int YELLOW_PIN = 3;
const int GREEN_PIN = 2;
#endif

void light(int r, int y, int g) {
  digitalWrite(RED_PIN, r); digitalWrite(YELLOW_PIN, y); digitalWrite(GREEN_PIN, g);
}

void setup() {
  Serial.begin(115200);
  pinMode(RED_PIN, OUTPUT); pinMode(YELLOW_PIN, OUTPUT); pinMode(GREEN_PIN, OUTPUT);
  Serial.println("EIT traffic-light ready");
}

void loop() {
  light(LOW, LOW, HIGH);  Serial.println("GREEN");  delay(3000);
  light(LOW, HIGH, LOW);  Serial.println("YELLOW"); delay(1000);
  light(HIGH, LOW, LOW);  Serial.println("RED");    delay(3000);
}
