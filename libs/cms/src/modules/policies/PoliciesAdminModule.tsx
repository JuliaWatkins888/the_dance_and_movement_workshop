import { useState } from 'react';
import { Box, Button, Icon, IconButton, ListRow, Text, dialog } from '@inithium/ui';
import type { IconName } from '@inithium/ui';
import { useDeletePolicyCategoryMutation, useDeletePolicyItemMutation, useListPoliciesQuery } from '@inithium/api-client';
import type { PolicyCategoryDto, PolicyItemDto } from '@inithium/api-client';
import { PolicyCategoryEditDialog } from './PolicyCategoryEditDialog';
import { PolicyItemEditDialog } from './PolicyItemEditDialog';

const CATEGORY_DIALOG_WIDTH = 480;
const ITEM_DIALOG_WIDTH = 760;

// No pagination/search/bulk-select here, unlike StaffAdminModule/GalleryAdminModule - a studio's
// set of policy categories (and each category's items) is small and curated by hand, not the
// kind of large, growing collection those composites earn their keep on.
export const PoliciesAdminModule = () => {
  const { data, isLoading, refetch } = useListPoliciesQuery();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [deleteCategory] = useDeletePolicyCategoryMutation();
  const [deleteItem] = useDeletePolicyItemMutation();

  const categories = data ?? [];
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? null;

  const openCreateCategoryDialog = () => {
    const id = dialog.show(
      () => (
        <PolicyCategoryEditDialog
          mode="create"
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: 'New Policy Category', width: CATEGORY_DIALOG_WIDTH },
    );
  };

  const openEditCategoryDialog = (category: PolicyCategoryDto) => {
    const id = dialog.show(
      () => (
        <PolicyCategoryEditDialog
          mode="edit"
          initialCategory={category}
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: `Edit "${category.title}"`, width: CATEGORY_DIALOG_WIDTH },
    );
  };

  const handleDeleteCategory = async (category: PolicyCategoryDto) => {
    const confirmed = await dialog.confirm({
      title: 'Delete this policy category?',
      description: `This permanently deletes "${category.title}" and all ${category.items.length} of its items from the public policies page. This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    await deleteCategory(category.id).unwrap();
    refetch();
  };

  const openCreateItemDialog = (categoryId: string) => {
    const id = dialog.show(
      () => (
        <PolicyItemEditDialog
          mode="create"
          categoryId={categoryId}
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: 'New Policy Item', width: ITEM_DIALOG_WIDTH },
    );
  };

  const openEditItemDialog = (categoryId: string, item: PolicyItemDto) => {
    const id = dialog.show(
      () => (
        <PolicyItemEditDialog
          mode="edit"
          categoryId={categoryId}
          initialItem={item}
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: `Edit "${item.title}"`, width: ITEM_DIALOG_WIDTH },
    );
  };

  const handleDeleteItem = async (categoryId: string, item: PolicyItemDto) => {
    const confirmed = await dialog.confirm({
      title: 'Delete this policy item?',
      description: `This permanently deletes "${item.title}" from the public policies page. This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    await deleteItem({ categoryId, itemId: item.id }).unwrap();
    refetch();
  };

  if (selectedCategory) {
    return (
      <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
        <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 16 }}>
          <Box flex={{ direction: 'row', align: 'center', gap: 12 }}>
            <IconButton icon="ArrowLeft" label="Back to categories" onClick={() => setSelectedCategoryId(null)} />
            <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
              {selectedCategory.title}
            </Text>
          </Box>
          <Button variant={{ kind: 'filled', color: 'primary' }} onClick={() => openCreateItemDialog(selectedCategory.id)}>
            Add Item
          </Button>
        </Box>

        <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
          {selectedCategory.items.length > 0 ? (
            selectedCategory.items.map((item) => (
              <ListRow
                key={item.id}
                trailing={
                  <>
                    <IconButton
                      icon="PencilSimple"
                      label={`Edit ${item.title}`}
                      onClick={() => openEditItemDialog(selectedCategory.id, item)}
                    />
                    <IconButton
                      icon="Trash"
                      label={`Delete ${item.title}`}
                      textColor={{ color: 'red', intensity: 600 }}
                      onClick={() => handleDeleteItem(selectedCategory.id, item)}
                    />
                  </>
                }
              >
                <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
                  {item.title}
                </Text>
              </ListRow>
            ))
          ) : (
            <Box padding={{ base: 24 }}>
              <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
                No items in this category yet.
              </Text>
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 16 }}>
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
          Policies
        </Text>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={openCreateCategoryDialog}>
          Add Category
        </Button>
      </Box>

      <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
        {isLoading ? (
          <Box padding={{ base: 24 }}>
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
              Loading policies...
            </Text>
          </Box>
        ) : categories.length > 0 ? (
          categories.map((category) => (
            <ListRow
              key={category.id}
              leading={category.icon ? <Icon name={category.icon as IconName} size={24} /> : undefined}
              trailing={
                <>
                  <IconButton icon="PencilSimple" label={`Edit ${category.title}`} onClick={() => openEditCategoryDialog(category)} />
                  <IconButton
                    icon="Trash"
                    label={`Delete ${category.title}`}
                    textColor={{ color: 'red', intensity: 600 }}
                    onClick={() => handleDeleteCategory(category)}
                  />
                  <IconButton
                    icon="CaretRight"
                    label={`Manage items in ${category.title}`}
                    onClick={() => setSelectedCategoryId(category.id)}
                  />
                </>
              }
            >
              <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
                {category.title}
              </Text>
              <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
                {category.items.length} item{category.items.length === 1 ? '' : 's'}
              </Text>
            </ListRow>
          ))
        ) : (
          <Box padding={{ base: 24 }}>
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
              No policy categories yet.
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};
