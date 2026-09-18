// EI TOKEN 案例 · RGB 彩灯
// 一颗灯变出七种颜色
// 适用：Arduino Uno / Arduino Nano / ESP32 DevKit / ESP32-S3 DevKitC

#if defined(CONFIG_IDF_TARGET_ESP32S3)
const int R_PIN = 18;
const int G_PIN = 38;
const int B_PIN = 39;
#elif defined(ESP32)
const int R_PIN = 26;
const int G_PIN = 27;
const int B_PIN = 14;
#else
const int R_PIN = 9;
const int G_PIN = 10;
const int B_PIN = 11;
#endif

void setColor(int r, int g, int b) {
  analogWrite(R_PIN, r);
  analogWrite(G_PIN, g);
  analogWrite(B_PIN, b);
}

void setup() {
  Serial.begin(115200);
  pinMode(R_PIN, OUTPUT); pinMode(G_PIN, OUTPUT); pinMode(B_PIN, OUTPUT);
  Serial.println("EIT rgb-led ready");
}

void loop() {
  const int colors[7][3] = {{255,0,0},{255,128,0},{255,255,0},{0,255,0},{0,255,255},{0,0,255},{160,0,255}};
  for (int i = 0; i < 7; i++) {
    setColor(colors[i][0], colors[i][1], colors[i][2]);
    Serial.print("color "); Serial.println(i);
    delay(600);
  }
}
