import React, { useState } from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraActive, setIsCameraActive] = useState(false);

  if (!permission) {
    return <Text>Checking permissions...</Text>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text>Camera access is required to use this feature.</Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isCameraActive ? (
        <CameraView style={styles.camera} />
      ) : (
        <Text>Press the button to open the camera</Text>
      )}
      <Button
        title={isCameraActive ? "Close Camera" : "Open Camera"}
        onPress={() => setIsCameraActive((prev) => !prev)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  camera: {
    width: "100%",
    height: "80%",
  },
});
