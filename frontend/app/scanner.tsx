import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../src/LanguageContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function ScannerScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [manualMode, setManualMode] = useState(Platform.OS === 'web');

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/foods/barcode/${data}`);
      if (response.ok) {
        const productData = await response.json();
        setProduct(productData);
      } else {
        Alert.alert(t('scan_not_found'), t('scan_not_found_desc'), [
          { text: t('nutr_search_btn'), onPress: () => router.push('/(tabs)/nutrition') },
          { text: t('scan_again'), onPress: () => { setScanned(false); setProduct(null); } }
        ]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to lookup product');
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  const addToLog = async () => {
    if (!product) return;
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      
      const nutrients = product.nutrients_per_100g || {};
      const elements: Record<string, number> = {};
      // Simple elemental calculation from macros
      const protein = nutrients.protein_g || 0;
      const carbs = nutrients.carbohydrate_g || 0;
      const fat = nutrients.fat_g || 0;
      elements['C'] = protein * 0.50 + carbs * 0.40 + fat * 0.76;
      elements['H'] = protein * 0.07 + carbs * 0.067 + fat * 0.123;
      elements['O'] = protein * 0.22 + carbs * 0.533 + fat * 0.117;
      elements['N'] = protein * 0.16;
      
      const response = await fetch(`${BACKEND_URL}/api/meals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          food_name: product.name || 'Scanned Product',
          portion_grams: 100,
          meal_type: 'snack',
          cooking_method: 'raw',
          nutrients: nutrients,
          elements: elements,
          allergens: product.allergens || []
        })
      });
      if (response.ok) {
        Alert.alert('Logged!', `${product.name} added to your meals.`, [
          { text: 'OK', onPress: () => { setScanned(false); setProduct(null); } }
        ]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to log meal');
    }
  };

  const resetScanner = () => {
    setScanned(false);
    setProduct(null);
  };

  // Web fallback - camera not supported
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('scan_title')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centered}>
          <Ionicons name="barcode-outline" size={64} color="#00d4ff" />
          <Text style={styles.title}>Barcode Scanner</Text>
          <Text style={styles.text}>Camera scanning is available on mobile devices.</Text>
          <Text style={styles.text}>Use the Expo Go app to scan barcodes.</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push('/(tabs)/nutrition')}>
            <Text style={styles.buttonText}>Search Foods Instead</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#00d4ff" />
          <Text style={styles.text}>Requesting camera permission...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Ionicons name="camera-outline" size={64} color="#ff6b6b" />
          <Text style={styles.title}>Camera Permission Required</Text>
          <Text style={styles.text}>Please enable camera access to scan barcodes</Text>
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, { backgroundColor: '#2a2a4e', marginTop: 12 }]} onPress={() => router.back()}>
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Barcode Scanner</Text>
        <View style={{ width: 24 }} />
      </View>

      {!product ? (
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] }}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          />
          <View style={styles.overlay}>
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <Text style={styles.scanText}>{loading ? 'Looking up product...' : 'Align barcode within frame'}</Text>
            {loading && <ActivityIndicator size="small" color="#00d4ff" style={{ marginTop: 12 }} />}
          </View>
        </View>
      ) : (
        <View style={styles.productContainer}>
          <View style={styles.productCard}>
            <Text style={styles.productName}>{product.name}</Text>
            {product.brand ? <Text style={styles.productBrand}>{product.brand}</Text> : null}
            
            <View style={styles.nutrientsCard}>
              <Text style={styles.nutrientsTitle}>Per 100g</Text>
              <View style={styles.nutrientRow}>
                <Text style={styles.nutrientLabel}>Calories</Text>
                <Text style={styles.nutrientValue}>{product.nutrients_per_100g?.energy_kcal || 0} kcal</Text>
              </View>
              <View style={styles.nutrientRow}>
                <Text style={styles.nutrientLabel}>Protein</Text>
                <Text style={styles.nutrientValue}>{product.nutrients_per_100g?.protein_g || 0}g</Text>
              </View>
              <View style={styles.nutrientRow}>
                <Text style={styles.nutrientLabel}>Carbs</Text>
                <Text style={styles.nutrientValue}>{product.nutrients_per_100g?.carbohydrate_g || 0}g</Text>
              </View>
              <View style={styles.nutrientRow}>
                <Text style={styles.nutrientLabel}>Fat</Text>
                <Text style={styles.nutrientValue}>{product.nutrients_per_100g?.fat_g || 0}g</Text>
              </View>
              <View style={styles.nutrientRow}>
                <Text style={styles.nutrientLabel}>Fiber</Text>
                <Text style={styles.nutrientValue}>{product.nutrients_per_100g?.fiber_g || 0}g</Text>
              </View>
            </View>

            {product.allergens && product.allergens.length > 0 && (
              <View style={styles.allergensCard}>
                <Ionicons name="warning" size={16} color="#ff6b6b" />
                <Text style={styles.allergensText}>Allergens: {product.allergens.join(', ')}</Text>
              </View>
            )}
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#2a2a4e' }]} onPress={resetScanner}>
              <Ionicons name="scan" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>{t('scan_again')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#00d4ff' }]} onPress={addToLog}>
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Add to Log</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 16 },
  text: { color: '#888', marginTop: 8, textAlign: 'center', paddingHorizontal: 20 },
  button: { backgroundColor: '#00d4ff', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, marginTop: 24 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  scannerContainer: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  scanFrame: { width: 280, height: 180, position: 'relative' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#00d4ff', borderWidth: 3 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanText: { color: '#fff', marginTop: 24, fontSize: 14 },
  productContainer: { flex: 1, padding: 16 },
  productCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 20 },
  productName: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  productBrand: { fontSize: 14, color: '#888', marginBottom: 16 },
  nutrientsCard: { backgroundColor: '#2a2a4e', borderRadius: 12, padding: 16, marginTop: 12, marginBottom: 16 },
  nutrientsTitle: { fontSize: 14, color: '#888', marginBottom: 12 },
  nutrientRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  nutrientLabel: { color: '#aaa', fontSize: 14 },
  nutrientValue: { color: '#fff', fontWeight: '600', fontSize: 14 },
  allergensCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 107, 107, 0.1)', padding: 12, borderRadius: 8 },
  allergensText: { color: '#ff6b6b', marginLeft: 8, fontSize: 13, flex: 1 },
  buttonRow: { flexDirection: 'row', marginTop: 20 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, marginHorizontal: 4 },
  actionBtnText: { color: '#fff', fontWeight: '600', marginLeft: 8 },
});
