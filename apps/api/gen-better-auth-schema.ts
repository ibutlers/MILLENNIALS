import { getAuthTables } from 'better-auth/db';
import { twoFactor } from 'better-auth/plugins';
import { organization } from 'better-auth/plugins';

// Create a minimal config with the plugins we need
const config = {
  plugins: [
    twoFactor(),
    organization()
  ],
  database: {
    provider: 'postgres'
  }
};

const schema = getAuthTables(config);

// Output the schema as JSON so we can parse it
const output: Record<string, unknown> = {};
for (const [key, table] of Object.entries(schema)) {
  const fields: Record<string, unknown> = {};
  for (const [fieldName, field] of Object.entries(table.fields)) {
    fields[fieldName] = {
      type: field.type,
      fieldName: field.fieldName || fieldName,
      required: field.required ?? false,
      unique: field.unique ?? false,
      defaultValue: field.defaultValue ?? null,
      references: field.references || null,
      returnFieldName: ('returnFieldName' in field) ? (field as any).returnFieldName : undefined
    };
  }
  output[key] = {
    modelName: table.modelName,
    fields
  };
}
console.log(JSON.stringify(output, null, 2));
