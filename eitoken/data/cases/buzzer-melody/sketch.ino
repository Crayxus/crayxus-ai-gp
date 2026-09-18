// EI TOKEN 案例 · 蜂鸣器小曲
// 用无源蜂鸣器弹一段《小星星》
// 适用：Arduino Uno / Arduino Nano / ESP32 DevKit / ESP32-S3 DevKitC

#if defined(CONFIG_IDF_TARGET_ESP32S3)
const int BUZZER_PIN = 17;
#elif defined(ESP32)
const int BUZZER_PIN = 25;
#else
const int BUZZER_PIN = 8;
#endif

// 《小星星》前两句：C C G G A A G
const int melody[]   = {262, 262, 392, 392, 440, 440, 392};
const int duration[] = {400, 400, 400, 400, 400, 400, 800};

void setup() {
  Serial.begin(115200);
  Serial.println("EIT buzzer-melody ready");
}

void loop() {
  for (int i = 0; i < 7; i++) {
    tone(BUZZER_PIN, melody[i], duration[i] * 0.9);
    Serial.print("note "); Serial.println(melody[i]);
    delay(duration[i]);
  }
  noTone(BUZZER_PIN);
  delay(1500);
}
