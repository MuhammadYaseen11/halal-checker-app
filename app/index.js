import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Alert, ActivityIndicator, Modal, TextInput } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import axios from 'axios';

export default function App() {
  const [hasPermission, setHasPermission] = useState(null);
  const [cameraActive, setCameraActive] = useState(false); // ✅ Controls camera state
  const [scanned, setScanned] = useState(false);
  const [productInfo, setProductInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = useCameraPermissions();

  const [modalVisible, setModalVisible] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductIngredients, setNewProductIngredients] = useState('');
  const [currentBarcode, setCurrentBarcode] = useState('');

  useEffect(() => {
    (async () => {
      if (permission?.status !== 'granted') {
        await requestPermission();
        setHasPermission(permission?.status === 'granted');
      } else {
        setHasPermission(true);
      }
    })();
  }, [permission]);

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned || loading) return; // Prevent multiple triggers

    setScanned(true);
    setLoading(true);
    setCameraActive(false); // ✅ Close camera after scanning

    try {
      const response = await axios.post('http://localhost:5001/scan-product', { barcode: data });
      const productData = response?.data || {};

      if (productData.status === 'Product Not Available') {
        setProductInfo({ name: 'Unknown', status: 'Not Found', ingredients: [] });
        setCurrentBarcode(data);
        Alert.alert(
          'Product Not Found',
          'Do you want to add this product?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add Product', onPress: () => setModalVisible(true) }
          ]
        );
      } else {
        setProductInfo(productData);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch product information.');
    } finally {
      setLoading(false);
    }
  };

  const addProduct = async () => {
    if (!newProductName) {
      Alert.alert('Error', 'Product name is required.');
      return;
    }

    try {
      await axios.post('http://localhost:5001/add-product', {
        barcode: currentBarcode,
        name: newProductName.trim(),
        type: 'food',
        ingredients: newProductIngredients.split(',').map(ing => ing.trim()),
        status: 'Unknown',
      });
      Alert.alert('Success', 'Product added successfully.');
    } catch (error) {
      Alert.alert('Error', 'Failed to add product.');
    } finally {
      setModalVisible(false);
      setNewProductName('');
      setNewProductIngredients('');
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <Text>Requesting camera permission...</Text>
        <Button title="Allow Camera" onPress={requestPermission} />
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Text>No access to camera</Text>
        <Button title="Allow Camera" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading && <ActivityIndicator size="large" color="#00ff00" />}

      {cameraActive ? (
        <CameraView
          style={styles.camera}
          facing={facing}
          onBarcodeScanned={handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'code128', 'ean13', 'ean8'],
          }}
        >
          <View style={styles.scanBox} />
        </CameraView>
      ) : (
        <View style={styles.center}>
          <Button title="Open Camera" onPress={() => setCameraActive(true)} />
        </View>
      )}

      {scanned && productInfo && (
        <View style={styles.infoBox}>
          <Text style={styles.text}>Name: {productInfo.name}</Text>
          <Text style={styles.text}>Status: {productInfo.status}</Text>
          <Text style={styles.text}>
            Ingredients: {productInfo.ingredients?.join(', ') || 'None'}
          </Text>
          <Button
            title="Scan Again"
            onPress={() => {
              setScanned(false);
              setProductInfo(null);
              setCameraActive(false);
            }}
          />
        </View>
      )}

      {/* Modal for Adding New Product */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Add New Product</Text>
            <TextInput
              style={styles.input}
              placeholder="Product Name"
              value={newProductName}
              onChangeText={setNewProductName}
            />
            <TextInput
              style={styles.input}
              placeholder="Ingredients (comma separated)"
              value={newProductIngredients}
              onChangeText={setNewProductIngredients}
            />
            <View style={styles.modalButtons}>
              <Button title="Cancel" onPress={() => setModalVisible(false)} />
              <Button title="Add" onPress={addProduct} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scanBox: {
    flex: 1,
    borderWidth: 2,
    borderColor: 'white',
    margin: 40,
    borderRadius: 10,
  },
  infoBox: {
    padding: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  text: {
    fontSize: 18,
    marginBottom: 10,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    marginBottom: 15,
  },
  input: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    marginBottom: 15,
    padding: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
});
