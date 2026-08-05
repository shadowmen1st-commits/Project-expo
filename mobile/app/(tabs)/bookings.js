import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Theme';

export default function BookingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>No active bookings</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: Colors.textMuted,
    fontSize: 16,
  },
});
