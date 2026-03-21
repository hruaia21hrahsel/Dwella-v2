import { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Text, FAB } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDocuments } from '@/hooks/useDocuments';
import { useProperties } from '@/hooks/useProperties';
import { useTenants } from '@/hooks/useTenants';
import { useAuthStore } from '@/lib/store';
import { useTheme } from '@/lib/theme-context';
import { useToastStore } from '@/lib/toast';
import { deleteDocument } from '@/lib/documents';
import { DocumentCard } from '@/components/DocumentCard';
import { DocumentUploader } from '@/components/DocumentUploader';
import { DocumentViewer } from '@/components/DocumentViewer';
import { CategoryFilterBar } from '@/components/CategoryFilterBar';
import { EmptyState } from '@/components/EmptyState';
import { ListSkeleton } from '@/components/ListSkeleton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { Document, DocumentCategory } from '@/lib/types';

export default function PropertyDocumentsScreen() {
  const { id: propertyId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const showToast = useToastStore((s) => s.showToast);
  const { user } = useAuthStore();

  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | null>(null);
  const [uploaderVisible, setUploaderVisible] = useState(false);
  const [uploadTenantId, setUploadTenantId] = useState<string | null>(null);
  const [viewerDoc, setViewerDoc] = useState<Document | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { documents, isLoading: docsLoading, refresh } = useDocuments(propertyId ?? null);
  const { tenants } = useTenants(propertyId ?? undefined);
  const { ownedProperties, tenantProperties } = useProperties();

  // Determine if current user is owner of this property
  const property =
    ownedProperties.find((p) => p.id === propertyId) ??
    tenantProperties.find((tp) => tp.properties?.id === propertyId)?.properties ?? null;
  const isOwner = property != null && property.owner_id === user?.id;

  // Find current user's tenant record in this property
  const myTenantRecord = tenants.find((t) => t.user_id === user?.id);

  function filterByCategory(docs: Document[]) {
    if (!selectedCategory) return docs;
    return docs.filter((d) => d.category === selectedCategory);
  }

  const propertyDocs = filterByCategory(documents.filter((d) => d.tenant_id === null));

  function handleOpenUploader(tenantId: string | null) {
    setUploadTenantId(tenantId);
    setUploaderVisible(true);
  }

  async function handleConfirmDelete() {
    if (!deleteDoc) return;
    setIsDeleting(true);
    try {
      await deleteDocument(deleteDoc);
      showToast('Document deleted', 'success');
      refresh();
    } catch {
      showToast('Could not delete file. Please try again.', 'error');
    } finally {
      setIsDeleting(false);
      setDeleteDoc(null);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Documents',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: colors.background } as object,
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              hitSlop={8}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="chevron-left" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Main scroll */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={docsLoading} onRefresh={refresh} />}
      >
        {/* Category filter bar */}
        <CategoryFilterBar selected={selectedCategory} onSelect={setSelectedCategory} />

        {/* Property Documents section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Property Documents</Text>

        {docsLoading ? (
          <ListSkeleton count={3} rowHeight={72} />
        ) : propertyDocs.length === 0 ? (
          isOwner ? (
            <EmptyState
              icon="file-document-outline"
              title="No property documents yet"
              subtitle="Upload leases, insurance, or other files for this property."
              actionLabel="Upload Document"
              onAction={() => handleOpenUploader(null)}
            />
          ) : (
            <EmptyState
              icon="file-document-outline"
              title="No property documents yet"
              subtitle="Your landlord hasn't uploaded any property documents yet."
            />
          )
        ) : (
          propertyDocs.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              currentUserId={user?.id ?? ''}
              onPress={setViewerDoc}
              onDelete={setDeleteDoc}
            />
          ))
        )}

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.divider }]} />

        {/* Tenant sections */}
        {isOwner ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Tenant Documents</Text>
            {tenants.length === 0 ? (
              <EmptyState
                icon="account-outline"
                title="No tenants yet"
                subtitle="Add tenants to this property to manage their documents."
              />
            ) : (
              tenants.map((tenant) => {
                const tenantDocs = filterByCategory(
                  documents.filter((d) => d.tenant_id === tenant.id),
                );
                return (
                  <View key={tenant.id} style={styles.tenantBlock}>
                    <Text style={[styles.tenantSubHeader, { color: colors.textPrimary }]}>
                      {tenant.tenant_name}
                    </Text>
                    {tenantDocs.length === 0 ? (
                      <EmptyState
                        icon="file-outline"
                        title="No documents uploaded"
                        subtitle="No documents have been uploaded for this tenant."
                        actionLabel="Upload Document"
                        onAction={() => handleOpenUploader(tenant.id)}
                      />
                    ) : (
                      tenantDocs.map((doc) => (
                        <DocumentCard
                          key={doc.id}
                          document={doc}
                          currentUserId={user?.id ?? ''}
                          onPress={setViewerDoc}
                          onDelete={setDeleteDoc}
                        />
                      ))
                    )}
                  </View>
                );
              })
            )}
          </>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>My Documents</Text>
            {myTenantRecord ? (
              (() => {
                const myDocs = filterByCategory(
                  documents.filter((d) => d.tenant_id === myTenantRecord.id),
                );
                return myDocs.length === 0 ? (
                  <EmptyState
                    icon="file-outline"
                    title="No documents uploaded"
                    subtitle="Upload your ID, lease, or other documents for your tenancy."
                    actionLabel="Upload Document"
                    onAction={() => handleOpenUploader(myTenantRecord.id)}
                  />
                ) : (
                  myDocs.map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      document={doc}
                      currentUserId={user?.id ?? ''}
                      onPress={setViewerDoc}
                      onDelete={setDeleteDoc}
                    />
                  ))
                );
              })()
            ) : (
              <EmptyState
                icon="file-outline"
                title="No documents uploaded"
                subtitle="Upload your ID, lease, or other documents for your tenancy."
              />
            )}
          </>
        )}
      </ScrollView>

      {/* FAB */}
      {propertyId && (
        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: colors.primary }]}
          color="#fff"
          label={isOwner ? 'Upload Document' : 'Upload to My Tenancy'}
          onPress={() => {
            if (isOwner) {
              handleOpenUploader(null);
            } else if (myTenantRecord) {
              handleOpenUploader(myTenantRecord.id);
            }
          }}
        />
      )}

      {/* Document Uploader */}
      {propertyId && (
        <DocumentUploader
          visible={uploaderVisible}
          propertyId={propertyId}
          tenantId={uploadTenantId}
          tenants={isOwner ? tenants : undefined}
          onUploadComplete={() => refresh()}
          onClose={() => setUploaderVisible(false)}
        />
      )}

      {/* Document Viewer */}
      <DocumentViewer
        visible={viewerDoc !== null}
        document={viewerDoc}
        onClose={() => setViewerDoc(null)}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        visible={deleteDoc !== null}
        title="Delete Document?"
        message="This will permanently remove the file and cannot be undone."
        confirmLabel="Delete Document"
        confirmColor={colors.error}
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDoc(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 4,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  tenantBlock: {
    marginBottom: 16,
  },
  tenantSubHeader: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
  },
});
