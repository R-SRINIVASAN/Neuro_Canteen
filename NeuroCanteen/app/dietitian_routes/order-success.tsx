import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CircleCheck, ShoppingBag } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

export default function OrderSuccess() {
  const router = useRouter();
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [uhid, setUhid] = useState<string>('');
  const pageKey = Date.now(); // Force re-mount on each navigation

  useEffect(() => {
    console.log("=== Dietitian Order Success Page Loaded ===");
    console.log("Page key:", pageKey);
    
    let sound: Audio.Sound;
    
    const getUhid = async () => {
      const id = await AsyncStorage.getItem('patientUHID');
      if (id) {
        setUhid(id);
      }
    };
    
    const playSoundAndAnimate = async () => {
      // Start animation immediately, don't wait for sound
      animatedValue.setValue(0);
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
      console.log("Animation started");
      
      // Try to play sound, but don't let it block the page
      try {
        console.log("Loading and playing success sound...");
        // Load and play sound
        const { sound: newSound } = await Audio.Sound.createAsync(
          require('../../assets/sounds/success.mp3') // sound path
        );
        sound = newSound;
        await sound.playAsync();
        console.log("Success sound played successfully");
      } catch (error) {
        console.error("Error in playSoundAndAnimate:", error);
        // Sound failed, but page should still work
        console.log("Sound failed to play, but animation and page are working");
      }
    };
    
    getUhid();
    playSoundAndAnimate();
    
    // Clean up the sound when component unmounts
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [pageKey]);

  const iconScale = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1.2, 1],
  });

  const textOpacity = animatedValue.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0, 0, 1],
  });

  const handleViewOrders = () => {
    router.push({
      pathname: '/dietitian_routes/diet-history',
      params: { patientuhid: uhid }
    });
  };

  const handleBackToMenu = () => {
    router.push('/(dietitians)');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.iconContainer,
            { transform: [{ scale: iconScale }] }
          ]}
        >
          <CircleCheck size={80} color="#4A8F47" />
        </Animated.View>

        <Animated.Text style={[styles.title, { opacity: textOpacity }]}>
          Order Successfully Placed!
        </Animated.Text>

        <Animated.Text style={[styles.message, { opacity: textOpacity }]}>
          Order for {uhid} has been confirmed and is being processed. Thank you for choosing us!
        </Animated.Text>

        <Animated.View style={[styles.buttonsContainer, { opacity: textOpacity }]}>
          <TouchableOpacity style={styles.button} onPress={handleViewOrders}>
            <ShoppingBag size={20} color="white" />
            <Text style={styles.buttonText}>View Orders</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleBackToMenu}
          >
            <Text style={styles.secondaryButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  iconContainer: {
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 15,
    color: '#333',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
    maxWidth: 300,
  },
  buttonsContainer: {
    width: '100%',
    maxWidth: 300,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A8F47',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4A8F47',
  },
  secondaryButtonText: {
    color: '#4A8F47',
    fontSize: 16,
    fontWeight: '600',
  },
});
