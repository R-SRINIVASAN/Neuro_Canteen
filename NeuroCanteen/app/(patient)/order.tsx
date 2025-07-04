import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Minus, Plus, ChevronRight, ArrowLeft } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../api/axiosInstance';
import { Link } from 'expo-router';

type MenuItem = {
  id: number;
  name: string;
  description: string;
  staffPrice: number;
  patientPrice: number;
  dietitianPrice: number;
  picture: string | null;
  category: string;
  available: boolean;
  role: string;
};

type CartItems = { [key: string]: number };

const { width } = Dimensions.get('window');
const CARD_MARGIN = 8;
const CARD_WIDTH = Platform.OS === 'web' ? 300 : (width - (CARD_MARGIN * 4)) / 2;

export default function PatientOrderScreen() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cartItems, setCartItems] = useState<CartItems>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [categories, setCategories] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    loadCart();
    fetchMenuItems();
  }, []);

  const fetchMenuItems = async () => {
    try {
      const response = await axiosInstance.get('/menu-items');
      if (Array.isArray(response.data)) {
        setMenuItems(response.data);
        const uniqueCategories = [...new Set(response.data.map((item: MenuItem) => item.category))];
        console.log('Loaded categories:', uniqueCategories);
        setCategories(uniqueCategories);
      } else {
        console.error('API response is not an array:', response.data);
        setMenuItems([]);
        setCategories([]);
      }
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error fetching menu items:', error);
      setMenuItems([]);
      setCategories([]);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadCart = async () => {
    try {
      const savedCart = await AsyncStorage.getItem('patient_cart');
      if (savedCart) {
        // Clean the saved cart data to remove control characters
        let cleanedCart = savedCart;
        if (typeof cleanedCart === 'string') {
          cleanedCart = cleanedCart.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
        }
        
        try {
          setCartItems(JSON.parse(cleanedCart));
        } catch (parseError) {
          console.error('Error parsing saved cart:', parseError);
          console.error('Cleaned cart data:', cleanedCart);
          // If parsing fails, clear the corrupted cart
          await AsyncStorage.removeItem('patient_cart');
          setCartItems({});
        }
      }
    } catch (error) {
      console.error('Error loading cart:', error);
      // If loading fails, clear the cart
      setCartItems({});
    }
  };

  useEffect(() => {
    const saveCart = async () => {
      try {
        await AsyncStorage.setItem('patient_cart', JSON.stringify(cartItems));
      } catch (error) {
        console.error('Error saving cart:', error);
      }
    };
    saveCart();
  }, [cartItems]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMenuItems();
  };

  const handleAddToCart = (item: MenuItem) => {
    setCartItems((prevCart) => ({
      ...prevCart,
      [item.id]: (prevCart[item.id] || 0) + 1,
    }));
  };

  const handleIncreaseQuantity = (itemId: number) => {
    setCartItems((prevCart) => ({
      ...prevCart,
      [itemId]: (prevCart[itemId] || 0) + 1,
    }));
  };

  const handleDecreaseQuantity = (itemId: number) => {
    setCartItems((prevCart) => {
      const newCart = { ...prevCart };
      if (newCart[itemId] > 1) {
        newCart[itemId] -= 1;
      } else {
        delete newCart[itemId];
      }
      return newCart;
    });
  };

  const handleCheckout = () => {
    if (Object.keys(cartItems).length === 0) {
      alert('Your cart is empty!');
      return;
    }
    
    router.push({
      pathname: '/(patient)/checkout',
      params: { 
        cartItems: JSON.stringify(cartItems),
        menuItems: JSON.stringify(menuItems)
      }
    });
      setCartItems({});
      AsyncStorage.removeItem('patient_cart');
  };

  const calculateTotal = () => {
    return Object.keys(cartItems).reduce((total, itemId) => {
      const item = menuItems.find(item => item.id === parseInt(itemId));
      if (!item) return total;
      return total + (item.patientPrice * cartItems[itemId]);
    }, 0);
  };

  const totalItems = Object.values(cartItems).reduce((sum, quantity) => sum + quantity, 0);

  const filteredMenuItems = selectedCategory === 'All' 
  ? menuItems 
  : menuItems.filter(item => item.category === selectedCategory);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#4A8F47" />
        <Text style={styles.loadingText}>Loading menu...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={20} color="#2E7D32" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Menu</Text>
      </View>

      <View style={styles.categoryWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.categoryContainer}
        >
          <TouchableOpacity
            key="All"
            style={[
              styles.categoryButton,
              selectedCategory === 'All' && styles.categoryButtonActive
            ]}
            onPress={() => setSelectedCategory('All')}
          >
            <Text style={[
              styles.categoryButtonText,
              selectedCategory === 'All' && styles.categoryButtonTextActive
            ]}>
              All
            </Text>
          </TouchableOpacity>
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryButton,
                selectedCategory === category && styles.categoryButtonActive
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[
                styles.categoryButtonText,
                selectedCategory === category && styles.categoryButtonTextActive
              ]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.menuArea}
        contentContainerStyle={styles.menuGrid}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredMenuItems.map((item) => (
          <View key={item.id} style={styles.menuItem}>
            <Image 
              source={item.picture ? { uri: item.picture } : require('../../assets/images/icon.png')} 
              style={styles.itemImage}
            />
            <View style={styles.menuItemDetails}>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.itemDescription} numberOfLines={2}>
                {item.description}
              </Text>
              <View style={styles.priceActionContainer}>
                <Text style={styles.itemPrice}>₹{item.patientPrice}</Text>
                {cartItems[item.id] ? (
                  <View style={styles.quantityControls}>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => handleDecreaseQuantity(item.id)}
                    >
                      <Minus size={14} color="#4A8F47" />
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{cartItems[item.id]}</Text>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => handleIncreaseQuantity(item.id)}
                    >
                      <Plus size={14} color="#4A8F47" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => handleAddToCart(item)}
                    disabled={!item.available}
                  >
                    <Text style={styles.addButtonText}>
                      {item.available ? 'ADD' : 'UNAVAILABLE'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {Object.keys(cartItems).length > 0 && (
        <TouchableOpacity style={styles.cartBar} onPress={handleCheckout}>
          <View style={styles.cartInfo}>
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{totalItems}</Text>
            </View>
            <Text style={styles.cartText}>View Cart</Text>
          </View>
          <View style={styles.cartTotal}>
            <Text style={styles.cartTotalText}>₹{calculateTotal()}</Text>
            <ChevronRight size={20} color="white" />
          </View>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F3F4',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: '#2E7D32',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
    flex: 1,
    textAlign: 'center',
    marginLeft: -40,
  },
  categoryWrapper: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    height: 50,
  },
  categoryContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: '100%',
  },
  categoryButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 4,
    minWidth: 60,
    alignItems: 'center',
  },
  categoryButtonActive: {
    backgroundColor: '#4A8F47',
  },
  categoryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  categoryButtonTextActive: {
    color: 'white',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#4A8F47',
  },
  menuArea: {
    flex: 1,
  },
  menuGrid: {
    padding: CARD_MARGIN,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuItem: {
    width: CARD_WIDTH,
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: CARD_MARGIN * 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  itemImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  menuItemDetails: {
    padding: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    lineHeight: 18,
  },
  priceActionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4A8F47',
  },
  addButton: {
    backgroundColor: '#4A8F47',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    padding: 2,
  },
  quantityButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  quantityText: {
    marginHorizontal: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  cartBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#4A8F47',
    padding: 15,
    paddingBottom: Platform.OS === 'ios' ? 30 : 15,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  cartInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartBadge: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  cartBadgeText: {
    color: '#4A8F47',
    fontSize: 12,
    fontWeight: '600',
  },
  cartText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cartTotal: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartTotalText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 5,
  },
}); 
