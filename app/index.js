// Frontend: index.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001';

export default function BarcodeChecker() {
  const [barcode, setBarcode] = useState('');
  const [result, setResult] = useState(null);

  const checkBarcode = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/check-barcode`, { barcode });
      setResult(response.data);
      console.log(response.data);
    } 
    catch (error) {
      setResult({ status: "Error", message: "Failed to check barcode." });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Check Halal Status</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter Barcode"
        value={barcode}
        onChangeText={setBarcode}
      />
      <TouchableOpacity style={styles.button} onPress={checkBarcode}>
        <Text style={styles.buttonText}>Check</Text>
      </TouchableOpacity>
      {result && (
        <Text style={styles.result}>Status: {result.status}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  header: { fontSize: 24, textAlign: 'center', marginBottom: 10 },
  input: { borderBottomWidth: 1, padding: 8, marginBottom: 10 },
  button: { backgroundColor: '#4CAF50', padding: 10, borderRadius: 5, alignItems: 'center' },
  buttonText: { color: 'white', fontSize: 16 },
  result: { marginTop: 10, fontSize: 18, textAlign: 'center' }
});