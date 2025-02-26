import React, { useState, useRef } from 'react';
import { View, Text, Alert, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function BarcodeScanner() {
  const [status] = useCameraPermissions();
  const [barcodeData, setBarcodeData] = useState('');
  const [isScanning, setIsScanning] = useState(true);
  const timeoutRef = useRef(null);
  const lastScannedRef = useRef(''); // Track the last scanned barcode

  // Handle barcode scan result with improved handling
  const handleBarcodeScan = ({ data }) => {
    // If scanner is paused or this is the same barcode as last time, ignore it
    if (!isScanning || data === lastScannedRef.current) return;
    
    // New barcode detected - update state
    setIsScanning(false);
    setBarcodeData(data);
    lastScannedRef.current = data; // Store this barcode to prevent rescanning
    
    Alert.alert("Barcode Scanned", `Data: ${data}`);
    
    // Reset scanning state after delay, but maintain the lastScanned value
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsScanning(true);
      // We don't reset lastScannedRef here, so it will still prevent duplicate scans
    }, 3000);
  };

  // Reset scanner to scan a new barcode (even if it's the same as before)
  const resetScanner = () => {
    lastScannedRef.current = ''; // Clear the last scanned value
    setIsScanning(true);
  };

  // If permission is not granted, show an alert
  if (status?.granted === false) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Camera permission is required to scan barcodes</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        onBarcodeScanned={isScanning ? handleBarcodeScan : undefined}
        style={{ flex: 1 }}
        barcodeTypes={['ean13', 'qr', 'upc_a', 'upc_e']}
      />
      
      {barcodeData && (
        <View 
          style={{ 
            position: 'absolute', 
            bottom: 50, 
            left: 20, 
            right: 20,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: 15,
            borderRadius: 8
          }}
        >
          <Text style={{ color: 'white', fontSize: 18 }}>
            Scanned Barcode: {barcodeData}
          </Text>
          
          <TouchableOpacity 
            onPress={resetScanner}
            style={{
              backgroundColor: '#2196F3',
              padding: 10,
              borderRadius: 5,
              marginTop: 10,
              alignItems: 'center'
            }}
          >
            <Text style={{ color: 'white' }}>Scan New Barcode</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}