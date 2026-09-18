// EI TOKEN 案例 · 按键开关灯
// 按一下灯亮，再按一下灯灭
// 适用：Arduino Uno / Arduino Nano / ESP32 DevKit / ESP32-S3 DevKitC

#if defined(CONFIG_IDF_TARGET_ESP32S3)
const int BTN_PIN = 4;
const int LED_PIN = 2;
#elif defined(ESP32)
const int BTN_PIN = 4;
const int LED_PIN = 2;
#else
const int BTN_PIN = 2;
const int LED_PIN = 13;
#endif

bool ledOn = false;
int lastState = HIGH;
unsigned long lastChange = 0;

void setup() {
  Serial.begin(115200);
  pinMode(BTN_PIN, INPUT_PULLUP);   // 内部上拉：没按是 HIGH，按下是 LOW
  pinMode(LED_PIN, OUTPUT);
  Serial.println("EIT button-led ready");
}

void loop() {
  int s = digitalRead(BTN_PIN);
  if (s != lastState && millis() - lastChange > 40) {   // 40ms 消抖
    lastChange = millis();
    lastState = s;
    if (s == LOW) {
      ledOn = !ledOn;
      digitalWrite(LED_PIN, ledOn ? HIGH : LOW);
      Serial.println(ledOn ? "LED ON" : "LED OFF");
    }
  }
}
