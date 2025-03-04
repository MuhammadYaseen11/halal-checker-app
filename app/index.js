import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Alert, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Set your API base URL here
const API_BASE_URL = 'http://82.18.226.204:5001'; // Adjust port if needed

// Create axios instance with timeout and headers
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 3000, // 10 second timeout
  headers: {
    'Content-Type': 'application/json',
  }
});

export default function BarcodeScanner() {
  const [status] = useCameraPermissions();
  const [barcodeData, setBarcodeData] = useState('');
  const [isScanning, setIsScanning] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [productDetails, setProductDetails] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingProducts, setPendingProducts] = useState([]);
  const [newProduct, setNewProduct] = useState({
    name: '',
    type: 'food', // Default to food
    ingredients: '',
    status: 'Unknown'
  });
  
  const timeoutRef = useRef(null);
  const lastScannedRef = useRef('');

  // Load pending products on component mount
  useEffect(() => {
    loadPendingProducts();
  }, []);

  // Load pending products from storage
  const loadPendingProducts = async () => {
    try {
      const storedProducts = await AsyncStorage.getItem('pendingProducts');
      if (storedProducts) {
        setPendingProducts(JSON.parse(storedProducts));
      }
    } catch (error) {
      console.error('Error loading pending products:', error);
    }
  };

  // Save pending products to storage
  const savePendingProducts = async (products) => {
    try {
      await AsyncStorage.setItem('pendingProducts', JSON.stringify(products));
      setPendingProducts(products);
    } catch (error) {
      console.error('Error saving pending products:', error);
    }
  };

  // Load cached product
  const loadCachedProduct = async (barcode) => {
    try {
      const cachedProducts = await AsyncStorage.getItem('cachedProducts');
      if (cachedProducts) {
        const products = JSON.parse(cachedProducts);
        return products[barcode] || null;
      }
      return null;
    } catch (error) {
      console.error('Error loading cached product:', error);
      return null;
    }
  };

  // Save product to cache
  const cacheProduct = async (product) => {
    try {
      const cachedProducts = await AsyncStorage.getItem('cachedProducts');
      const products = cachedProducts ? JSON.parse(cachedProducts) : {};
      products[product.barcode] = product;
      await AsyncStorage.setItem('cachedProducts', JSON.stringify(products));
    } catch (error) {
      console.error('Error caching product:', error);
    }
  };

  // Handle barcode scan result
  const handleBarcodeScan = async ({ data }) => {
    // If scanner is paused or this is the same barcode as last time, ignore it
    if (!isScanning || data === lastScannedRef.current) return;
    
    // New barcode detected - update state
    setIsScanning(false);
    setBarcodeData(data);
    lastScannedRef.current = data;
    
    // Fetch product details from the database
    await fetchProductDetails(data);
    
    // Reset scanning state after delay, but maintain the lastScanned value
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsScanning(true);
    }, 3000);
  };

  // Fetch product details from API
  const fetchProductDetails = async (barcode) => {
    setIsLoading(true);
    
    try {
      // First check if we have the product cached
      const cachedProduct = await loadCachedProduct(barcode);
      
      if (cachedProduct) {
        setProductDetails(cachedProduct);
        setShowAddForm(false);
        setIsOffline(false);
        setIsLoading(false);
        return;
      }
      
      // Try to fetch from server
      const response = await api.post('/scan-product', { barcode });
      
      if (response.data.status === "Product Not Available") {
        // Product not in database, show add form
        setShowAddForm(true);
        setProductDetails(null);
      } else {
        // Product found, show details and cache it
        setProductDetails(response.data);
        setShowAddForm(false);
        await cacheProduct(response.data);
      }
      
      setIsOffline(false);
    } catch (error) {
      console.error('Error fetching product details:', error);
      
      // Network error handling
      if (error.code === 'ECONNABORTED' || !error.response) {
        setIsOffline(true);
        Alert.alert(
          "Network Error", 
          "Unable to connect to the server. Working in offline mode."
        );
        
        // Check if we have the product in cache
        const cachedProduct = await loadCachedProduct(barcode);
        if (cachedProduct) {
          setProductDetails(cachedProduct);
          setShowAddForm(false);
        } else {
          // Not in cache, allow offline adding
          setShowAddForm(true);
          setProductDetails(null);
        }
      } else {
        Alert.alert(
          "Error", 
          "Failed to fetch product details. Please try again."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Add new product to the database
  const handleAddProduct = async () => {
    if (!newProduct.name.trim()) {
      Alert.alert("Error", "Product name is required");
      return;
    }
    
    setIsLoading(true);
    
    // Parse ingredients from comma-separated string to array
    const ingredientsArray = newProduct.ingredients
      .split(',')
      .map(item => item.trim())
      .filter(item => item !== '');
    
    const productData = {
      barcode: barcodeData,
      name: newProduct.name,
      type: newProduct.type,
      ingredients: ingredientsArray,
      status: newProduct.status
    };
    
    try {
      if (isOffline) {
        // Add to pending products if offline
        const updatedPending = [...pendingProducts, productData];
        await savePendingProducts(updatedPending);
        
        // Also cache the product for immediate use
        await cacheProduct(productData);
        
        Alert.alert(
          "Saved Offline", 
          "Product saved locally. It will be uploaded when you're back online."
        );
        
        setProductDetails(productData);
        setShowAddForm(false);
      } else {
        // Online - send directly to server
        const response = await api.post('/add-product', productData);
        Alert.alert("Success", "Product added successfully!");
        
        // Cache the product
        await cacheProduct(productData);
        
        setShowAddForm(false);
        setProductDetails(productData);
      }
    } catch (error) {
      console.error('Error adding product:', error);
      
      if (error.code === 'ECONNABORTED' || !error.response) {
        // Network error - save locally
        setIsOffline(true);
        const updatedPending = [...pendingProducts, productData];
        await savePendingProducts(updatedPending);
        
        // Also cache the product for immediate use
        await cacheProduct(productData);
        
        Alert.alert(
          "Saved Offline", 
          "Network error. Product saved locally and will be uploaded when you're back online."
        );
        
        setProductDetails(productData);
        setShowAddForm(false);
      } else {
        Alert.alert(
          "Error", 
          error.response?.data?.message || "Failed to add product. Please try again."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Sync pending products with server
  const syncPendingProducts = async () => {
    if (pendingProducts.length === 0) return;
    
    setIsLoading(true);
    Alert.alert("Syncing", "Attempting to sync offline products...");
    
    let successCount = 0;
    let remainingProducts = [...pendingProducts];
    
    for (const product of pendingProducts) {
      try {
        await api.post('/add-product', product);
        successCount++;
        remainingProducts = remainingProducts.filter(p => p.barcode !== product.barcode);
      } catch (error) {
        console.error('Error syncing product:', error);
        // Continue with other products if one fails
      }
    }
    
    await savePendingProducts(remainingProducts);
    
    setIsLoading(false);
    Alert.alert(
      "Sync Complete", 
      `${successCount} products uploaded. ${remainingProducts.length} products remaining.`
    );
  };

  // Reset scanner to scan a new barcode
  const resetScanner = () => {
    lastScannedRef.current = '';
    setBarcodeData('');
    setProductDetails(null);
    setShowAddForm(false);
    setIsScanning(true);
    setNewProduct({
      name: '',
      type: 'food',
      ingredients: '',
      status: 'Unknown'
    });
  };

  // Attempt to reconnect
  const attemptReconnect = async () => {
    setIsLoading(true);
    try {
      await api.get('/');
      setIsOffline(false);
      Alert.alert("Connected", "Successfully reconnected to server!");
      
      // Try to sync pending products
      await syncPendingProducts();
    } catch (error) {
      Alert.alert("Still Offline", "Could not connect to server. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  // If permission is not granted, show an alert
  if (status?.granted === false) {
    return (
      <View style={styles.centeredContainer}>
        <Text>Camera permission is required to scan barcodes</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!barcodeData ? (
        <>
          <CameraView
            onBarcodeScanned={isScanning ? handleBarcodeScan : undefined}
            style={styles.camera}
            barcodeTypes={['ean13', 'qr', 'upc_a', 'upc_e']}
          />
          
          {isOffline && (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineText}>OFFLINE MODE</Text>
              <TouchableOpacity
                style={styles.reconnectButton}
                onPress={attemptReconnect}
              >
                <Text style={styles.reconnectText}>Reconnect</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {pendingProducts.length > 0 && (
            <TouchableOpacity
              style={styles.pendingButton}
              onPress={syncPendingProducts}
            >
              <Text style={styles.pendingText}>
                {pendingProducts.length} product(s) pending upload
              </Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        <ScrollView style={styles.resultContainer}>
          <View style={styles.card}>
            {isOffline && (
              <View style={styles.offlineIndicator}>
                <Text style={styles.offlineIndicatorText}>OFFLINE MODE</Text>
              </View>
            )}
            
            <Text style={styles.title}>Scanned Barcode</Text>
            <Text style={styles.barcode}>{barcodeData}</Text>
            
            {isLoading && (
              <ActivityIndicator size="large" color="#2196F3" style={styles.loader} />
            )}
            
            {productDetails && !isLoading && (
              <View style={styles.detailsContainer}>
                <Text style={styles.subtitle}>Product Details</Text>
                <Text style={styles.detailText}>Name: {productDetails.name}</Text>
                <Text style={styles.detailText}>
                  Status: <Text style={getStatusStyle(productDetails.status)}>{productDetails.status}</Text>
                </Text>
                
                {productDetails.ingredients && productDetails.ingredients.length > 0 && (
                  <View>
                    <Text style={styles.detailText}>Ingredients:</Text>
                    <Text style={styles.ingredients}>{productDetails.ingredients.join(', ')}</Text>
                  </View>
                )}
              </View>
            )}
            
            {showAddForm && !isLoading && (
              <View style={styles.formContainer}>
                <Text style={styles.subtitle}>Add New Product</Text>
                
                <Text style={styles.label}>Product Name:</Text>
                <TextInput
                  style={styles.input}
                  value={newProduct.name}
                  onChangeText={(text) => setNewProduct({...newProduct, name: text})}
                  placeholder="Enter product name"
                />
                
                <Text style={styles.label}>Type:</Text>
                <View style={styles.radioGroup}>
                  <TouchableOpacity
                    style={[styles.radioButton, newProduct.type === 'food' && styles.radioSelected]}
                    onPress={() => setNewProduct({...newProduct, type: 'food'})}
                  >
                    <Text>Food</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.radioButton, newProduct.type === 'non-food' && styles.radioSelected]}
                    onPress={() => setNewProduct({...newProduct, type: 'non-food'})}
                  >
                    <Text>Non-Food</Text>
                  </TouchableOpacity>
                </View>
                
                {newProduct.type === 'food' && (
                  <>
                    <Text style={styles.label}>Ingredients (comma separated):</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={newProduct.ingredients}
                      onChangeText={(text) => setNewProduct({...newProduct, ingredients: text})}
                      placeholder="e.g. flour, water, salt, sugar"
                      multiline
                      numberOfLines={3}
                    />
                    
                    <Text style={styles.label}>Status:</Text>
                    <View style={styles.radioGroup}>
                      <TouchableOpacity
                        style={[styles.statusButton, styles.halalButton, newProduct.status === 'Halal' && styles.radioSelected]}
                        onPress={() => setNewProduct({...newProduct, status: 'Halal'})}
                      >
                        <Text style={styles.statusText}>Halal</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.statusButton, styles.haramButton, newProduct.status === 'Haram' && styles.radioSelected]}
                        onPress={() => setNewProduct({...newProduct, status: 'Haram'})}
                      >
                        <Text style={styles.statusText}>Haram</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.statusButton, styles.unknownButton, newProduct.status === 'Unknown' && styles.radioSelected]}
                        onPress={() => setNewProduct({...newProduct, status: 'Unknown'})}
                      >
                        <Text style={styles.statusText}>Unknown</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
                
                <TouchableOpacity 
                  style={styles.addButton}
                  onPress={handleAddProduct}
                >
                  <Text style={styles.buttonText}>
                    {isOffline ? "Save Offline" : "Add Product"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.scanButton}
              onPress={resetScanner}
            >
              <Text style={styles.buttonText}>Scan New Barcode</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// Helper function to get text style based on product status
const getStatusStyle = (status) => {
  switch(status?.toLowerCase()) {
    case 'halal':
      return styles.halalStatus;
    case 'haram':
      return styles.haramStatus;
    case 'non-food item':
      return styles.nonFoodStatus;
    default:
      return styles.unknownStatus;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  camera: {
    flex: 1,
  },
  resultContainer: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  barcode: {
    fontSize: 18,
    marginBottom: 16,
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  loader: {
    marginVertical: 20,
  },
  detailsContainer: {
    marginBottom: 16,
  },
  detailText: {
    fontSize: 16,
    marginBottom: 8,
  },
  ingredients: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  formContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  radioGroup: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  radioButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 8,
    marginRight: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  radioSelected: {
    backgroundColor: '#e6f7ff',
    borderColor: '#1890ff',
  },
  statusButton: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    marginRight: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  halalButton: {
    borderColor: '#4CAF50',
  },
  haramButton: {
    borderColor: '#F44336',
  },
  unknownButton: {
    borderColor: '#9E9E9E',
  },
  statusText: {
    fontWeight: '500',
  },
  halalStatus: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  haramStatus: {
    color: '#F44336',
    fontWeight: 'bold',
  },
  nonFoodStatus: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  unknownStatus: {
    color: '#9E9E9E',
    fontWeight: 'bold',
  },
  scanButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  offlineBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(244, 67, 54, 0.8)',
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  offlineText: {
    color: 'white',
    fontWeight: 'bold',
  },
  reconnectButton: {
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  reconnectText: {
    color: '#F44336',
    fontWeight: '500',
  },
  pendingButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(33, 150, 243, 0.9)',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  pendingText: {
    color: 'white',
    fontWeight: '500',
  },
  offlineIndicator: {
    backgroundColor: '#ffcdd2',
    padding: 5,
    borderRadius: 4,
    marginBottom: 10,
    alignItems: 'center',
  },
  offlineIndicatorText: {
    color: '#F44336',
    fontWeight: 'bold',
  },
});