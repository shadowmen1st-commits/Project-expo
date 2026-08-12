import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius } from '../theme';
import api from '../config/api';

interface Category {
  id?: string;
  _id?: string;
  name: string;
  icon?: string;
  description?: string;
}

interface CategorySelectorProps {
  selectedCategoryId?: string;
  selectedCategoryName?: string;
  onSelect: (category: Category) => void;
  categoriesList?: Category[];
  error?: string;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  selectedCategoryId,
  selectedCategoryName,
  onSelect,
  categoriesList,
  error,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [categories, setCategories] = useState<Category[]>(categoriesList || []);
  const [loading, setLoading] = useState(!categoriesList?.length);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (categoriesList && categoriesList.length > 0) {
      setCategories(categoriesList);
      setLoading(false);
      return;
    }

    const fetchCategories = async () => {
      try {
        setLoading(true);
        const response = await api.get('/categories');
        const list = Array.isArray(response.data) ? response.data : response.data?.categories || [];
        setCategories(list);
      } catch (err) {
        console.error('Failed to load categories in selector:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, [categoriesList]);

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedItem = categories.find(
    (c) => (c.id || c._id) === selectedCategoryId || c.name === selectedCategoryName
  );

  const displayName = selectedItem?.name || selectedCategoryName || 'Select Service Category';

  return (
    <View style={styles.container}>
      <Text style={styles.label}>SERVICE CATEGORY</Text>
      
      <TouchableOpacity
        style={[styles.selectorButton, Boolean(error) && styles.selectorError]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="grid-outline" size={20} color={colors.primaryDark} style={styles.leftIcon} />
        <Text style={[styles.selectorText, !selectedItem && !selectedCategoryName && styles.placeholderText]}>
          {displayName}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
      </TouchableOpacity>

      {Boolean(error) && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Service Category</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search category (e.g. Cleaning, Plumbing)..."
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={setSearch}
              />
            </View>

            {loading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading categories...</Text>
              </View>
            ) : filteredCategories.length === 0 ? (
              <View style={styles.centerContainer}>
                <Ionicons name="alert-circle-outline" size={40} color={colors.textMuted} />
                <Text style={styles.emptyText}>No categories found</Text>
              </View>
            ) : (
              <FlatList
                data={filteredCategories}
                keyExtractor={(item, index) => item.id || item._id || String(index)}
                renderItem={({ item }) => {
                  const itemId = item.id || item._id;
                  const isSelected = itemId === selectedCategoryId || item.name === selectedCategoryName;
                  return (
                    <TouchableOpacity
                      style={[styles.itemRow, isSelected && styles.itemRowSelected]}
                      onPress={() => {
                        onSelect(item);
                        setModalVisible(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.itemLeft}>
                        <View style={[styles.iconBox, isSelected && styles.iconBoxSelected]}>
                          <Ionicons
                            name="construct-outline"
                            size={18}
                            color={isSelected ? colors.primaryDark : colors.textSecondary}
                          />
                        </View>
                        <Text style={[styles.itemName, isSelected && styles.itemNameSelected]}>
                          {item.name}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={22} color={colors.primaryDark} />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  selectorError: {
    borderColor: colors.error,
  },
  leftIcon: {
    marginRight: spacing.sm,
  },
  selectorText: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  placeholderText: {
    color: colors.textMuted,
    fontWeight: typography.weights.regular,
  },
  errorText: {
    fontSize: typography.sizes.xs,
    color: colors.error,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '80%',
    minHeight: 360,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    marginVertical: spacing.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.xs,
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
  },
  centerContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  emptyText: {
    marginTop: spacing.sm,
    fontSize: typography.sizes.md,
    color: colors.textMuted,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  itemRowSelected: {
    backgroundColor: colors.primaryLight,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconBoxSelected: {
    backgroundColor: colors.surface,
  },
  itemName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
  },
  itemNameSelected: {
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
});
