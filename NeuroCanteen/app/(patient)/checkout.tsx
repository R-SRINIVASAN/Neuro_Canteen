import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../api/axiosInstance';
import RazorpayCheckout from 'react-native-razorpay';
import { Link } from 'expo-router';
import { Package, ShoppingCart, Wallet, ArrowLeft, Phone } from 'lucide-react-native';

type MenuItem = {
  id: number;
  name: string;
  patientPrice: number;
  category?: string;
};

type CartItems = {
  [key: number]: number;
};

type OrderDetails = {
  orderedRole: string;
  orderedName: string;
  orderedUserId: string;
  itemName: string;
  quantity: number;
  category: string;
  price: number;
  orderStatus: string | null;
  paymentType: string;
  paymentStatus: string | null;
  orderDateTime: string;
  address: string;
  phoneNo: string;
  paymentRecived: boolean;
};

export default function patientOrderCheckout() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const params = useLocalSearchParams();
  const router = useRouter();
  const [tip, setTip] = useState(0);
  const MAX_TIP = 500;
  const [address, setAddress] = useState('');
  const [submittedAddress, setSubmittedAddress] = useState('');
  const [isEditing, setIsEditing] = useState(true);
  const [username, setUsername] = useState('');
  const [showUHIDModal, setShowUHIDModal] = useState(false);
  const [uhidInput, setUhidInput] = useState('');
  const [uhidVerified, setUhidVerified] = useState(false);
  const [verifyingUHID, setVerifyingUHID] = useState(false);

  useEffect(() => {
    const fetchUsername = async () => {
      const token = await AsyncStorage.getItem("jwtToken");
      if (token) {
        try {
          const { sub } = JSON.parse(atob(token.split('.')[1]));
          console.log("Decoded user:", sub);
          setUsername(sub);
        } catch (error) {
          console.error("Error decoding JWT token:", error);
        }
      }
    };
    fetchUsername();
  }, []);

  const cartItems: CartItems = params.cartItems ? (() => {
    try {
      // Clean the cart items data to remove control characters
      let cleanedCartItems = params.cartItems as string;
      if (typeof cleanedCartItems === 'string') {
        cleanedCartItems = cleanedCartItems.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
      }
      return JSON.parse(cleanedCartItems);
    } catch (error) {
      console.error('Error parsing cart items:', error);
      return {};
    }
  })() : {};
  
  const menuItems: MenuItem[] = params.menuItems ? (() => {
    try {
      // Clean the menu items data to remove control characters
      let cleanedMenuItems = params.menuItems as string;
      if (typeof cleanedMenuItems === 'string') {
        cleanedMenuItems = cleanedMenuItems.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
      }
      return JSON.parse(cleanedMenuItems);
    } catch (error) {
      console.error('Error parsing menu items:', error);
      return [];
    }
  })() : [];

  const calculateItemTotal = (item: MenuItem, quantity: number) => {
    return item.patientPrice * quantity;
  };

  const calculateOrderTotal = () => {
    let total = 0;
    for (const itemId in cartItems) {
      const item = menuItems.find(menuItem => menuItem.id === parseInt(itemId));
      if (item) {
        total += calculateItemTotal(item, cartItems[parseInt(itemId)]);
      }
    }
    return total;
  };
  
  const orderTotal = calculateOrderTotal();
  const deliveryFee = 0;
  const platformFee = 0;
  const GST_PERCENT = 12;
  const gstAmount = (orderTotal * GST_PERCENT) / 100;
  const grandTotal = orderTotal + deliveryFee + platformFee + gstAmount;

  const handleAddressSubmit = () => {
    if (!customerName.trim()) {
      Alert.alert("Error", "Please enter your name");
      return;
    }
    if (!phoneNumber.trim()) {
      Alert.alert("Error", "Please enter your mobile number");
      return;
    }
    if (!/^\d{10}$/.test(phoneNumber)) {
      Alert.alert("Error", "Please enter a valid 10-digit phone number");
      return;
    }
    setSubmittedAddress(address);
    setIsEditing(false);
  };

  const handleAddressEdit = () => {
    setAddress(submittedAddress);
    setIsEditing(true);
  };

  const verifyUHID = async () => {
    if (!uhidInput.trim()) {
      Alert.alert("Error", "Please enter your UHID");
      return false;
    }

    setVerifyingUHID(true);
    try {
      const response = await axiosInstance.post("/authenticate/patient", { uhid: uhidInput });
      if (response.data.jwt) {
        await AsyncStorage.setItem("jwtToken", response.data.jwt);
        setUhidVerified(true);
        setShowUHIDModal(false);
        setUsername(uhidInput);
        return true;
      }
    } catch (error) {
      console.error("UHID verification error:", error);
      Alert.alert("Error", "Invalid UHID. Please try again.");
      return false;
    } finally {
      setVerifyingUHID(false);
    }
    return false;
  };

  const handleUPI = async () => {
    if (!submittedAddress) {
      Alert.alert("Error", "Please enter the mobile number and delivery address!");
      return;
    }
    const token = await AsyncStorage.getItem("jwtToken");
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        if (decoded.sub === "Public") {
          setShowUHIDModal(true);
          return;
        }
        await proceedWithUPIPayment();
      } catch (error) {
        console.error('Error decoding token:', error);
        setShowUHIDModal(true);
      }
    } else {
      setShowUHIDModal(true);
    }
  };

  const proceedWithUPIPayment = async () => {
    try {
      const token = await AsyncStorage.getItem("jwtToken");
      let usernameToUse = username;
      
      if (token) {
        try {
          const userpayload = JSON.parse(atob(token.split('.')[1]));
          usernameToUse = userpayload.sub;
        } catch (error) {
          console.error('Error decoding token:', error);
        }
      }

      const payment_metadata = await axiosInstance.post("/payment/createOrder", { price: grandTotal });
      const { orderId, amount } = payment_metadata.data;

      const options = {
        key: "rzp_test_0oZHIWIDL59TxD",
        amount: amount * 100,
        currency: "INR",
        name: customerName,
        description: "Payment for Order",
        order_id: orderId,
        prefill: {
          name: customerName,
          email: "user@example.com",
          contact: phoneNumber,
        },
        notes: {
          address: submittedAddress,
        },
      };

      RazorpayCheckout.open(options)
        .then(async (response) => {
          await verifyPayment(response);
        })
        .catch((error) => {
          if (error.code !== 'USER_CLOSED') {
            Alert.alert("Payment Failed", "Please try again or choose a different payment method.");
          }
        });
    } catch (error) {
      console.error("Payment error:", error);
      Alert.alert("Error", "There was an issue processing your payment.");
    }
  };

  const verifyPayment = async (response: any) => {
    const paymentData = {
      orderId: response.razorpay_order_id,
      paymentId: response.razorpay_payment_id,
      paymentSignature: response.razorpay_signature,
      paymentStatus: response.razorpay_payment_status || "captured",
      paymentMethod: response.method || "upi",
      amount: orderTotal,
      createdAt: new Date().toISOString(),
    };

    const token = await AsyncStorage.getItem("jwtToken");
    let usernameToUse = username;
    if (token) {
      try {
        const usernamepayload = JSON.parse(atob(token.split('.')[1]));
        usernameToUse = usernamepayload.sub;
      } catch (error) {
        console.error('Error decoding token:', error);
      }
    }

    const orderDetails: OrderDetails = {
      orderedRole: "Out_Patient",
      orderedName: customerName,
      orderedUserId: usernameToUse,
      itemName: Object.keys(cartItems).map(itemId => {
        const item = menuItems.find(menuItem => menuItem.id === parseInt(itemId));
        return item ? `${item.name} (${item.category}) X ${cartItems[parseInt(itemId)]}` : '';
      }).join(", "),
      quantity: Object.values(cartItems).reduce((acc, qty) => acc + qty, 0),
      category: "South",
      price: orderTotal,
      orderStatus: null,
      paymentType: "UPI",
      paymentStatus: null,
      orderDateTime: new Date().toISOString(),
      address: submittedAddress,
      phoneNo: phoneNumber,
      paymentRecived: false
    };

try {
  const result = await axiosInstance.post("/payment/verifyPayment", paymentData);
  if (result.data) { 
        orderDetails.paymentRecived = true;
    orderDetails.paymentStatus = "COMPLETED";
    await axiosInstance.post("/orders", orderDetails);
    await AsyncStorage.removeItem('patient_cart');
        router.replace({
          pathname: '/(patient)/order-success',
          params: {
            orderHistoryRedirect: '/(patient)/order-history',
            orderedUserId: usernameToUse,
            orderedRole: 'Out_Patient'
          }
        });
  } else {
    Alert.alert("Error", "Payment verification failed!");
  }
} catch (error) {
      console.error("Error verifying payment:", error);
  Alert.alert("Error", "There was an issue verifying your payment.");
}
  };

  const handleCOD = async () => {
    if (!submittedAddress) {
      Alert.alert("Error", "Please enter the mobile number and delivery address!");
      return;
    }

    const orderDetails = {
      orderedRole: "Out_Patient",
      orderedName: customerName,
      orderedUserId: username,
      itemName: Object.keys(cartItems).map(itemId => {
        const item = menuItems.find(menuItem => menuItem.id === parseInt(itemId));
        return item ? `${item.name} (${item.category}) X ${cartItems[parseInt(itemId)]}` : '';
      }).join(", "),
      quantity: Object.values(cartItems).reduce((acc, qty) => acc + qty, 0),
      category: "South",
      price: orderTotal,
      orderStatus: null,
      paymentType: "COD",
      paymentStatus: null,
      orderDateTime: new Date().toISOString(),
      address: submittedAddress,
      phoneNo: phoneNumber,
      paymentRecived: false
    };

    try {
      await axiosInstance.post("/orders", orderDetails);
      await AsyncStorage.removeItem('patient_cart');
      router.replace({
        pathname: '/(patient)/order-success',
        params: {
          orderHistoryRedirect: '/(patient)/order-history',
          orderedUserId: username,
          orderedRole: 'Out_Patient'
        }
      });
    } catch (error) {
      console.error("Order error:", error);
      Alert.alert("Error", "There was an issue submitting your order.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#2E7D32" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Checkout</Text>
      </View>
      <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
        >
        {/* Order Summary */}
        <View style={[styles.section, { marginTop: 10 }]}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.divider} />
          
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderText}>Item</Text>
            <Text style={styles.tableHeaderText}>Qty</Text>
            <Text style={styles.tableHeaderText}>Price</Text>
          </View>
          
          {Object.keys(cartItems).map((itemId, index) => {
            const item = menuItems.find(menuItem => menuItem.id === parseInt(itemId));
            if (!item) return null;
            return (
              <View key={itemId} style={[
                styles.tableRow,
                index % 2 === 0 && styles.tableRowEven
              ]}>
                <Text style={styles.tableCell}>
                  {item.name} ({item.category})
                </Text>
                <Text style={styles.tableCell}>{cartItems[parseInt(itemId)]}</Text>
                <Text style={styles.tableCell}>₹{calculateItemTotal(item, cartItems[parseInt(itemId)])}</Text>
              </View>
            );
          })}
        </View>

                {/* Delivery Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Details</Text>
          <View style={styles.divider} />
          
          {submittedAddress && !isEditing ? (
            <View style={styles.addressContainer}>
              <View style={styles.nameContainer}>
                <Text style={styles.nameLabel}>{customerName}</Text>
              </View>
              <View style={styles.phoneContainer}>
                <Phone size={20} color="#666" style={styles.phoneIcon} />
                <Text style={styles.phoneNumber}>{phoneNumber}</Text>
              </View>
              <Text style={styles.addressText}>{submittedAddress}</Text>
              <TouchableOpacity onPress={handleAddressEdit}>
                <Text style={styles.editButton}>Edit Details</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.addressInputContainer}>
              <View style={styles.nameInputContainer}>
                <TextInput
                  style={styles.nameInput}
                  value={customerName}
                  onChangeText={setCustomerName}
                  placeholder="Name *"
                />
                <Text style={styles.requiredText}>* Required</Text>
              </View>
              <View style={styles.phoneNumberContainer}>
                <TextInput
                  style={styles.phoneNumberInput}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder="Mobile Number *"
                  keyboardType="phone-pad"
                />
                <Text style={styles.requiredText}>* Required</Text>
              </View>
              <TextInput
                style={styles.addressInput}
                value={address}
                onChangeText={setAddress}
                placeholder="Delivery Address (Optional)"
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleAddressSubmit}
              >
                <Text style={styles.submitButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        {/* Order Total */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Total:</Text>
          <View style={styles.divider} />
          
          <View style={styles.summaryRow}>
            <Text>Item Total</Text>
            <Text>₹{orderTotal}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text>Delivery Fee</Text>
            <Text>₹{deliveryFee}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text>Platform Fee</Text>
            <Text>₹{platformFee}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text>GST ({GST_PERCENT}%)</Text>
            <Text>₹{gstAmount.toFixed(2)}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text>Delivery Tip</Text>
            <View style={styles.tipContainer}>
              <TextInput
                style={styles.tipInput}
                value={tip.toString()}
                onChangeText={(text) => {
                  const newTip = Math.max(0, Math.min(MAX_TIP, parseFloat(text) || 0));
                  setTip(newTip);
                }}
                keyboardType="numeric"
                placeholder="0"
              />
              <Text style={styles.tipNote}>Max: ₹{MAX_TIP}</Text>
            </View>
          </View>
          
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>TO PAY</Text>
            <Text style={styles.totalValue}>₹{grandTotal.toFixed(2)}</Text>
          </View>
        </View>

        {/* Payment Options */}
        <View style={styles.paymentOptionsContainer}>
          <View style={styles.paymentOptions}>
            <TouchableOpacity style={styles.codButton} onPress={handleCOD}>
              <Text style={styles.paymentButtonText}>Cash On Delivery</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.upiButton} onPress={handleUPI}>
              <Text style={styles.paymentButtonText}>UPI</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* UHID Verification Modal */}
      <Modal
        visible={showUHIDModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUHIDModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Enter Your UHID</Text>
            <Text style={styles.modalSubtitle}>Please enter your UHID to proceed with UPI payment</Text>
            
            <Text style={styles.inputLabel}>UHID</Text>
            <TextInput
              style={styles.modalInput}
              value={uhidInput}
              onChangeText={setUhidInput}
              placeholder="Enter your UHID"
              autoCapitalize="none"
            />
            
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowUHIDModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, verifyingUHID && styles.modalButtonDisabled]}
                onPress={async () => {
                  const verified = await verifyUHID();
                  if (verified) {
                    await proceedWithUPIPayment();
                  }
                }}
                disabled={verifyingUHID}
              >
                {verifyingUHID ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonText}>Verify & Pay</Text>
                )}
              </TouchableOpacity>
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
    backgroundColor: '#fff',
  },
  scrollView: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  tableHeaderText: {
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    color: '#333',
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tableRowEven: {
    backgroundColor: '#f9f9f9',
  },
  tableCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
  },
  addressContainer: {
    marginBottom: 16,
  },
  addressText: {
    marginBottom: 8,
  },
  editButton: {
    color: 'blue',
    textAlign: 'right',
  },
  addressInputContainer: {
    marginBottom: 16,
  },
  addressInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 8,
    minHeight: 100,
    marginBottom: 8,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#4A8F47',
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalRow: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 8,
  },
  totalLabel: {
    fontWeight: 'bold',
  },
  totalValue: {
    fontWeight: 'bold',
  },
  tipInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 4,
    width: 60,
    textAlign: 'center',
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipNote: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  paymentOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  codButton: {
    backgroundColor: '#4A8F47',
    padding: 15,
    borderRadius: 4,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  upiButton: {
    backgroundColor: '#4A8F47',
    padding: 15,
    borderRadius: 4,
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  paymentButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputLabel: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 5,
    backgroundColor: '#4A8F47',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  modalCancelButton: {
    backgroundColor: '#f44336',
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 16,
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  phoneNumberContainer: {
    marginBottom: 16,
  },
  phoneNumberInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  requiredText: {
    color: '#ff0000',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 20, // Add some padding at bottom
  },
  paymentOptionsContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  phoneIcon: {
    marginRight: 8,
  },
  phoneNumber: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  nameContainer: {
    marginBottom: 16,
  },
  nameLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  nameInputContainer: {
    marginBottom: 16,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
    fontSize: 16,
    backgroundColor: '#fff',
  },
});