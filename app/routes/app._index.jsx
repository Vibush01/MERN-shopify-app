import { useState, useEffect } from "react";
import { useActionData, useLoaderData, useNavigation, Form } from "react-router";
import {
  AppProvider,
  Page,
  Layout,
  Card,
  Button,
  TextField,
  BlockStack,
  Text,
  DataTable,
  Banner,
} from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "../shopify.server";
import connectDB from "../db.server";
import AuditLog from "../models/AuditLog";

// Injects the official Polaris CSS into the Shopify Admin iframe
export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

// 1. BACKEND LOADER: Fetches existing history from MongoDB when the page loads
export const loader = async ({ request }) => {
  await authenticate.admin(request); // Verifies the session
  await connectDB();

  const logs = await AuditLog.find({}).sort({ timestamp: -1 }).lean();

  return Response.json({
    logs: logs.map(log => ({
      id: log._id.toString(),
      announcementText: log.announcementText,
      timestamp: new Date(log.timestamp).toLocaleString(),
    }))
  });
};

// 2. BACKEND ACTION: Handles Form Submissions (Saves to DB & updates Metafields)
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  await connectDB();

  const formData = await request.formData();
  const announcementText = formData.get("announcementText");

  if (!announcementText || announcementText.trim() === "") {
    return Response.json({ error: "Announcement text cannot be empty" }, { status: 400 });
  }

  try {
    // A. Save to MongoDB Log History
    await AuditLog.create({ announcementText });

    // B. Save to Shopify App Metafield using GraphQL Admin API
    const response = await admin.graphql(
      `#graphql
      mutation CreateAppDataMetafield($metafields: [AppOwnedMetafieldInput!]!) {
        appOwnedMetafieldsSet(metafields: $metafields) {
          appOwnedMetafields {
            id
            namespace
            key
            value
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          metafields: [
            {
              namespace: "my_app",
              key: "announcement",
              type: "single_line_text_field",
              value: announcementText,
            },
          ],
        },
      }
    );

    const responseJson = await response.json();
    const userErrors = responseJson.data?.appOwnedMetafieldsSet?.userErrors || [];

    if (userErrors.length > 0) {
      return Response.json({ error: userErrors[0].message }, { status: 400 });
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: "Server error saving configuration" }, { status: 500 });
  }
};

// 3. FRONTEND UI: Renders the Polaris Admin Control Panel
export default function Index() {
  const { logs } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const [text, setText] = useState("");

  const isSubmitting = navigation.state === "submitting";

  // Clear text field after a successful save
  useEffect(() => {
    if (actionData?.success) {
      setText("");
    }
  }, [actionData]);

  // Map database entries into row formats for the data table
  const tableRows = logs.map((log) => [log.announcementText, log.timestamp]);

  return (
    <AppProvider i18n={enTranslations}>
      <Page title="Announcement Banner Configuration">
        <Layout>
          <Layout.Section>
            {actionData?.success && (
              <Banner title="Announcement saved successfully!" tone="success" />
            )}
            {actionData?.error && (
              <Banner title="Error saving announcement" tone="critical">
                <p>{actionData.error}</p>
              </Banner>
            )}
          </Layout.Section>

          <Layout.Section>
            <Card padding="400">
              <Form method="POST">
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Set Global Shop Banner Text
                  </Text>
                  <TextField
                    label="Banner Message"
                    name="announcementText"
                    value={text}
                    onChange={(val) => setText(val)}
                    autoComplete="off"
                    placeholder="e.g., Use code FLASH20 for 20% off today!"
                    disabled={isSubmitting}
                  />
                  <Button submit variant="primary" loading={isSubmitting}>
                    Save & Update Storefront
                  </Button>
                </BlockStack>
              </Form>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card padding="400">
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Modification Audit Trail
                </Text>
                {tableRows.length === 0 ? (
                  <Text as="p" tone="subdued">No logs recorded yet. Create an announcement above.</Text>
                ) : (
                  <DataTable
                    columnContentTypes={["text", "text"]}
                    headings={["Message text", "Updated At"]}
                    rows={tableRows}
                  />
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </AppProvider>
  );
}