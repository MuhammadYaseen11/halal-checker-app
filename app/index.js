import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import axios from 'axios';

export default function App() {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [productInfo, setProductInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = async ({ type, data }) => {
    setScanned(true);
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:5001/scan-product', { barcode: data });
      setProductInfo(response.data);

      if (response.data.status === 'Product Not Available') {
        Alert.alert(
          'Product Not Found',
          'Do you want to add this product?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add Product', onPress: () => addProductPrompt(data) }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch product information.');
    } finally {
      setLoading(false);
    }
  };

  const addProductPrompt = (barcode) => {
    Alert.prompt(
      'Add Product',
      'Enter product name and ingredients separated by commas.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Add',
          onPress: async (input) => {
            const [name, ingredients] = input.split(',');
            try {
              await axios.post('http://localhost:5001/add-product', {
                barcode,
                name: name.trim(),
                type: 'food',
                ingredients: ingredients.split(',').map(ing => ing.trim()),
                status: 'Unknown',
              });
              Alert.alert('Success', 'Product added successfully.');
            } catch (error) {
              Alert.alert('Error', 'Failed to add product.');
            }
          },
        },
      ]
    );
  };

  if (hasPermission === null) {
    return <Text>Requesting for camera permission...</Text>;
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <View style={styles.container}>
      {loading && <ActivityIndicator size="large" color="#00ff00" />}

      {!scanned && (
        <BarCodeScanner
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {scanned && (
        <View style={styles.infoBox}>
          {productInfo ? (
            <>
              <Text style={styles.text}>Name: {productInfo.name}</Text>
              <Text style={styles.text}>Status: {productInfo.status}</Text>
              <Text style={styles.text}>Ingredients: {productInfo.ingredients.join(', ')}</Text>
              <Button title={'Scan Again'} onPress={() => setScanned(false)} />
            </>
          ) : (
            <Text style={styles.text}>No Product Info</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBox: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    alignItems: 'center',
  },
  text: {
    fontSize: 18,
    marginBottom: 10,
  },
});
