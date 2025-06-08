import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xrumjtlmwcchuhkcmhhi.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhydW1qdGxtd2NjaHVoa2NtaGhpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTI2NjYyMSwiZXhwIjoyMDYwODQyNjIxfQ.qKB23L9Z1Viv1Gx9qKBOK8Ewjds5B5JXZpdjC8gGLKE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createDemoUser(email, password, name, role, region, district) {
  try {
    // Create the user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role, region, district }
    });

    if (authError) throw authError;

    // Create the user record in the users table
    const { error: profileError } = await supabase
      .from('users')
      .insert([{
        id: authData.user.id,
        email,
        full_name: name,
        role,
        region,
        district,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);

    if (profileError) throw profileError;

    console.log(`Created user: ${email}`);
    return true;
  } catch (error) {
    console.error(`Error creating user ${email}:`, error);
    return false;
  }
}

async function createDemoUsers() {
  await createDemoUser(
    'district@ecg.com',
    'password',
    'District Engineer',
    'district_engineer',
    'Accra',
    'Accra East'
  );

  await createDemoUser(
    'regional@ecg.com',
    'password',
    'Regional Engineer',
    'regional_engineer',
    'Accra'
  );

  await createDemoUser(
    'global@ecg.com',
    'password',
    'Global Engineer',
    'global_engineer'
  );
}

createDemoUsers(); 