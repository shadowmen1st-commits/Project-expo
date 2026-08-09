import { View, Text, StyleSheet, Image } from 'react-native';
import { Colors, Spacing } from '../../constants/Theme';
import { Briefcase } from 'lucide-react-native';

export default function BookingsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.emptyContainer}>
        <View style={styles.iconCircle}>
          <Briefcase size={48} color={Colors.textDim} />
        </View>
        <Text style={styles.title}>No Bookings Yet</Text>
        <Text style={styles.subtitle}>Your scheduled services will appear here. Start exploring our experts!</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyContainer: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
