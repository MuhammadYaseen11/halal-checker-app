import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useState, useEffect } from 'react';
import { Text, View, Button, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import axios from 'axios';

export default function Index() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [productData, setProductData] = useState({ name: '', status: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!permission) requestPermission();
  }, []);

  const handleBarCodeScanned = async ({ data }) => {
    setScanned(true);
    setLoading(true);

    try {
      const response = await axios.post('http://192.168.1.100:5001/scan-product', { barcode: data });
      setProductData(response.data);
    } catch (error) {
      console.error("API Error:", error);
      setProductData({ name: 'Error', status: 'API Error or No Data Found' });
    } finally {
      setLoading(false);
      setModalVisible(true);
    }
  };

  if (!permission) return <Text>Requesting camera permission...</Text>;
  if (permission && !permission.granted) return <Text>No access to camera</Text>;

  return (
    <View style={styles.container}>
      {!scanned && (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          onBarcodeScanned={handleBarCodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'qr'] }} // Supports common formats
        />
      )}

      {scanned && <Button title="Scan Again" onPress={() => setScanned(false)} />}

      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <View style={styles.modalView}>
          {loading ? (
            <ActivityIndicator size="large" color="#0000ff" />
          ) : (
            <>
              <Text style={styles.modalText}>{productData.name}</Text>
              <Text>Status: {productData.status}</Text>
              <Button title="Close" onPress={() => setModalVisible(false)} />
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  modalView: { margin: 20, padding: 35, backgroundColor: 'white', borderRadius: 10, alignItems: 'center' },
  modalText: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
});
