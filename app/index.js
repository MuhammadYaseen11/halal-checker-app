import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { CameraView, useCameraPermissions } from "expo-camera";

export default function App() {
  const [query, setQuery] = useState("");
  const [searchUrl, setSearchUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasPermission, requestPermission] = useCameraPermissions();

  // Function to generate a Google search query for halal/haram status
  const searchHalalStatus = (product) => {
    if (!product) return;
    setLoading(true);
    setResult(""); // Clear previous result
    const searchQuery = `${product} halal or haram ingredients certification`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
    setSearchUrl(url); // Set the URL to load in WebView
  };

  // Handle barcode scan
  const handleBarCodeScanned = ({ data }) => {
    setScanning(false); // Close camera
    setQuery(data); // Store scanned barcode (product name)
    searchHalalStatus(data); // Search Google for halal/haram details
  };

  // JavaScript to inject into WebView to extract search results
  const injectedJavaScript = `
    (function() {
      // Extract the first few search results
      const results = document.querySelectorAll('div.g');
      let summary = '';
      results.forEach(result => {
        const text = result.innerText.toLowerCase();
        if (text.includes('halal') || text.includes('haram')) {
          summary += text + '\\n\\n';
        }
      });
      // Send the summary back to React Native
      window.ReactNativeWebView.postMessage(summary);
    })();
    true; // Required for injectedJavaScript to work
  `;

  // Handle WebView message (search result summary)
  const handleWebViewMessage = (event) => {
    setLoading(false);
    const summary = event.nativeEvent.data;
    if (summary.includes("halal")) {
      setResult("The product is likely halal.");
    } else if (summary.includes("haram")) {
      setResult("The product is likely haram.");
    } else {
      setResult("Unable to determine if the product is halal or haram.");
    }
  };

  return (
    <View style={styles.container}>
      {scanning ? (
        // Camera view for scanning barcode
        <CameraView
          style={styles.camera}
          onBarcodeScanned={handleBarCodeScanned}
        >
          <Text style={styles.scanText}>Scan a barcode</Text>
        </CameraView>
      ) : (
        <View style={styles.content}>
          <TextInput
            style={styles.input}
            placeholder="Type or scan product barcode"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => searchHalalStatus(query)}
          />
          <Button title="Search" onPress={() => searchHalalStatus(query)} />
          <TouchableOpacity style={styles.scanButton} onPress={() => setScanning(true)}>
            <Text style={styles.scanButtonText}>Scan Barcode</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Display Google search results */}
      {searchUrl ? (
        <WebView
          source={{ uri: searchUrl }}
          style={styles.webview}
          injectedJavaScript={injectedJavaScript}
          onMessage={handleWebViewMessage}
        />
      ) : null}

      {/* Display loading indicator or result */}
      {loading ? (
        <ActivityIndicator size="large" color="blue" style={styles.loader} />
      ) : (
        <Text style={styles.resultText}>{result}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  scanButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "blue",
    borderRadius: 5,
  },
  scanButtonText: {
    color: "white",
    fontSize: 16,
  },
  camera: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scanText: {
    color: "white",
    fontSize: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 10,
    borderRadius: 5,
  },
  webview: {
    flex: 1,
    marginTop: 10,
  },
  loader: {
    marginTop: 20,
  },
  resultText: {
    marginTop: 20,
    fontSize: 18,
    textAlign: "center",
  },
});