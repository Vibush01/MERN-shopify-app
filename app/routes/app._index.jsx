import { useState, useEffect } from "react";
import { useActionData, useLoaderData, useNavigation, Form } from "react-router";
import {
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

import { authenticate } from "../shopify.server";
import connectDB from "../db.server";
import AuditLog from "../models/AuditLog";

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

  try {
    await connectDB();
  } catch (dbError) {
    console.error("🔥 MongoDB Connection Error:", dbError);
    return Response.json({ error: "Database Connection Failed: Check your VS Code terminal." }, { status: 500 });
  }

  const formData = await request.formData();
  const announcementText = formData.get("announcementText");

  if (!announcementText || announcementText.trim() === "") {
    return Response.json({ error: "Announcement text cannot be empty" }, { status: 400 });
  }

  // A. Save to MongoDB Log History
  try {
    await AuditLog.create({ announcementText });
  } catch (mongoError) {
    console.error("🔥 MongoDB Save Error:", mongoError);
    return Response.json({ error: "Failed to save to MongoDB. Is your IP whitelisted in Atlas?" }, { status: 500 });
  }

  // B. Save to Shopify Shop Metafield using GraphQL Admin API
  //    Using metafieldsSet (shop-owned) instead of appOwnedMetafieldsSet
  //    so the metafield is accessible in Liquid via {{ shop.metafields.my_app.announcement }}
  try {
    // First, get the Shop's GID (required as ownerId for metafieldsSet)
    const shopResponse = await admin.graphql(`#graphql
      query {
        shop {
          id
        }
      }
    `);
    const shopData = await shopResponse.json();
    const shopId = shopData.data.shop.id;

    // Now set the shop-owned metafield
    const response = await admin.graphql(
      `#graphql
      mutation SetShopMetafield($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
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
              ownerId: shopId,
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

    // Check for top-level GraphQL syntax or permission errors
    if (responseJson.errors) {
      console.error("🔥 GraphQL Top-Level Error:", responseJson.errors);
      return Response.json({ error: "Shopify API Error: " + responseJson.errors[0].message }, { status: 400 });
    }

    // Check for user errors in the specific mutation
    const userErrors = responseJson.data?.metafieldsSet?.userErrors || [];
    if (userErrors.length > 0) {
      console.error("🔥 GraphQL User Error:", userErrors);
      return Response.json({ error: "Shopify Metafield Error: " + userErrors[0].message }, { status: 400 });
    }

    return Response.json({ success: true });
  } catch (shopifyError) {
    console.error("🔥 Shopify Fetch Crash:", shopifyError);
    return Response.json({ error: "Shopify GraphQL request failed completely." }, { status: 500 });
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
  );
}