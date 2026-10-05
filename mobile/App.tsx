import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

/**
 * Gri Hesap Defteri — deneme kabuğu. Canlı siteyi tam ekran bir WebView içinde açar;
 * uygulamanın tüm ekranları ve verileri sitedekiyle aynıdır (site güncellenince bu da güncellenir).
 * Kaldırmak için `mobile/` klasörünü silmek yeterli.
 */
const SITE = "https://grihesapdefteri.vercel.app";
const HOST = new URL(SITE).host;

// Uygulamanın "Klasik" teması: yüklenirken beyaz parlama olmasın.
const BG = { light: "#e8e7e3", dark: "#0c0c0d" };
const INK = { light: "#141414", dark: "#ecebe6" };

export default function App() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}

function Shell() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const web = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);

  // Android geri tuşu: önce site içinde geri git, en baştaysa uygulamadan çık.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack) return false;
      web.current?.goBack();
      return true;
    });
    return () => sub.remove();
  }, [canGoBack]);

  // iOS'ta site kendi güvenli alan boşluklarını (çentik, ana ekran çubuğu) kullanır.
  // Android WebView'da bu boşluklar sayfaya iletilmediği için kabuk kendisi bırakır.
  const edges = Platform.OS === "android" ? (["top", "bottom"] as const) : ([] as const);

  return (
    <SafeAreaView edges={edges} style={[styles.fill, { backgroundColor: BG[scheme] }]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {failed ? (
        <View style={[styles.fill, styles.center]}>
          <Text style={[styles.title, { color: INK[scheme] }]}>Bağlantı kurulamadı</Text>
          <Text style={[styles.body, { color: INK[scheme] }]}>İnternet bağlantını kontrol edip tekrar dene.</Text>
          <Pressable
            onPress={() => {
              setFailed(false);
              web.current?.reload();
            }}
            style={[styles.button, { backgroundColor: INK[scheme] }]}
          >
            <Text style={{ color: BG[scheme], fontWeight: "600" }}>Tekrar dene</Text>
          </Pressable>
        </View>
      ) : null}
      <WebView
        ref={web}
        source={{ uri: SITE }}
        style={[styles.fill, { backgroundColor: BG[scheme] }, failed && styles.hidden]}
        // Oturum çerezi ve tema tercihi (localStorage) kalıcı olsun.
        sharedCookiesEnabled
        domStorageEnabled
        // iOS: kenardan kaydırarak geri; sayfa kendi "aşağı çekip yenile"sini kullanır.
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled={false}
        bounces={false}
        contentInsetAdjustmentBehavior="never"
        applicationNameForUserAgent="GriHesapDefteriApp"
        startInLoadingState
        renderLoading={() => (
          <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: BG[scheme] }]}>
            <ActivityIndicator color={INK[scheme]} />
          </View>
        )}
        onNavigationStateChange={(s) => setCanGoBack(s.canGoBack)}
        // Başka sitelere giden bağlantılar telefonun tarayıcısında açılsın.
        onShouldStartLoadWithRequest={(req) => {
          if (req.url.startsWith("about:") || req.url.startsWith("blob:") || req.url.startsWith("data:")) return true;
          try {
            if (new URL(req.url).host === HOST) return true;
          } catch {
            return true;
          }
          Linking.openURL(req.url).catch(() => {});
          return false;
        }}
        onError={() => setFailed(true)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: "none" },
  center: { alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  title: { fontSize: 20, fontWeight: "600" },
  body: { fontSize: 15, opacity: 0.7, textAlign: "center" },
  button: { marginTop: 12, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999 },
});
