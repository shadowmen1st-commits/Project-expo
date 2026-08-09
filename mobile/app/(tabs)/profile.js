import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Colors, Spacing, BorderRadius } from '../../constants/Theme';
import { LogOut, ChevronRight, Settings, Shield, CreditCard, User, HelpCircle } from 'lucide-react-native';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const MenuItem = ({ icon: Icon, title, onPress, showBorder = true }) => (
    <TouchableOpacity style={[styles.menuItem, !showBorder && { borderBottomWidth: 0 }]} onPress={onPress}>
      <View style={styles.menuItemLeft}>
        <View style={styles.iconContainer}>
          <Icon size={20} color={Colors.secondary} />
        </View>
        <Text style={styles.menuTitle}>{title}</Text>
      </View>
      <ChevronRight size={20} color={Colors.textDim} />
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarTextLarge}>{user?.name?.charAt(0) || 'U'}</Text>
        </View>
        <Text style={styles.userName}>{user?.name || 'User'}</Text>
        <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
        <TouchableOpacity style={styles.editButton}>
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.menuCard}>
        <MenuItem icon={User} title="Personal Information" />
        <MenuItem icon={CreditCard} title="Wallet & Payments" />
        <MenuItem icon={Shield} title="Privacy & Security" />
        <MenuItem icon={Settings} title="Settings" />
        <MenuItem icon={HelpCircle} title="Help & Support" showBorder={false} />
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <LogOut size={20} color={Colors.error} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Version 1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  profileHeader: {
    alignItems: 'center',
    padding: Spacing.xl,
    paddingTop: Spacing.xxl,
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 3,
    borderColor: Colors.primary,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  avatarTextLarge: {
    fontSize: 40,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
  },
  userEmail: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  editButton: {
    marginTop: Spacing.lg,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: BorderRadius.xxl,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editButtonText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  menuCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  menuTitle: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xxl,
    marginHorizontal: Spacing.lg,
    padding: 16,
    borderRadius: BorderRadius.xl,
    backgroundColor: 'rgba(220, 38, 38, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.1)',
  },
  logoutText: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: 'bold',
  },
  version: {
    textAlign: 'center',
    color: Colors.textDim,
    fontSize: 12,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
});
