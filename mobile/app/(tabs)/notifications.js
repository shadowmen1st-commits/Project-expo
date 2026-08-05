import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Theme';

export default function NotificationsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>You're all caught up!</Text>
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
