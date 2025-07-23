import React from 'react';
import { View, Text, PanGestureHandler, GestureHandlerRootView } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  clamp,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native';

interface CustomSliderProps {
  minimumValue: number;
  maximumValue: number;
  value: number;
  onValueChange: (value: number) => void;
  step?: number;
  style?: any;
}

export default function CustomSlider({
  minimumValue,
  maximumValue,
  value,
  onValueChange,
  step = 0.1,
  style,
}: CustomSliderProps) {
  const sliderWidth = 280;
  const thumbSize = 20;
  
  const translateX = useSharedValue(
    ((value - minimumValue) / (maximumValue - minimumValue)) * (sliderWidth - thumbSize)
  );

  const updateValue = (newTranslateX: number) => {
    const percentage = newTranslateX / (sliderWidth - thumbSize);
    const rawValue = minimumValue + percentage * (maximumValue - minimumValue);
    const steppedValue = Math.round(rawValue / step) * step;
    const clampedValue = Math.max(minimumValue, Math.min(maximumValue, steppedValue));
    onValueChange(clampedValue);
  };

  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      const newTranslateX = clamp(event.translationX + translateX.value, 0, sliderWidth - thumbSize);
      translateX.value = newTranslateX;
      runOnJS(updateValue)(newTranslateX);
    })
    .onEnd(() => {
      // Update the base position for next gesture
      translateX.value = ((value - minimumValue) / (maximumValue - minimumValue)) * (sliderWidth - thumbSize);
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Update thumb position when value changes externally
  React.useEffect(() => {
    translateX.value = ((value - minimumValue) / (maximumValue - minimumValue)) * (sliderWidth - thumbSize);
  }, [value, minimumValue, maximumValue]);

  return (
    <GestureHandlerRootView style={[styles.container, style]}>
      <View style={[styles.track, { width: sliderWidth }]}>
        <View 
          style={[
            styles.activeTrack, 
            { width: ((value - minimumValue) / (maximumValue - minimumValue)) * sliderWidth }
          ]} 
        />
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.thumb, thumbStyle]} />
        </GestureDetector>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 40,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    backgroundColor: '#e5e5e5',
    borderRadius: 2,
    position: 'relative',
  },
  activeTrack: {
    height: 4,
    backgroundColor: '#000',
    borderRadius: 2,
    position: 'absolute',
  },
  thumb: {
    width: 20,
    height: 20,
    backgroundColor: '#000',
    borderRadius: 10,
    position: 'absolute',
    top: -8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});