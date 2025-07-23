import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mic, Music, TrendingUp } from 'lucide-react-native';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>SingBetter</Text>
          <Text style={styles.subtitle}>Practice singing with real-time pitch tracking</Text>
        </View>

        <View style={styles.featuresContainer}>
          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Mic size={24} color="#666" />
            </View>
            <Text style={styles.featureTitle}>Real-time Pitch Tracking</Text>
            <Text style={styles.featureDescription}>
              See your pitch in real-time and compare it with reference songs
            </Text>
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Music size={24} color="#666" />
            </View>
            <Text style={styles.featureTitle}>Song Library</Text>
            <Text style={styles.featureDescription}>
              Add and manage your favorite songs for practice
            </Text>
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <TrendingUp size={24} color="#666" />
            </View>
            <Text style={styles.featureTitle}>Progress Tracking</Text>
            <Text style={styles.featureDescription}>
              Monitor your singing improvement over time
            </Text>
          </View>
        </View>

        <Link href="/pitch-tracker" asChild>
          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Start Practicing</Text>
          </TouchableOpacity>
        </Link>
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
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  header: {
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  featuresContainer: {
    marginBottom: 48,
  },
  feature: {
    marginBottom: 32,
  },
  featureIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: '#000',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});