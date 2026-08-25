// supabase.js
// Ponto único de conexão com o Supabase. Importe { supabase } deste arquivo
// em qualquer outro .js do projeto (form.js, admin.js, publico.js, etc).

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://zqaozrockgktjuumokox.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxYW96cm9ja2drdGp1dW1va294Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MDQ3NTUsImV4cCI6MjEwMzA4MDc1NX0.d0rgfHXPr5lxBDCOA3ikzamZnGDuq9RuugpWLPwj-WA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Nome do bucket de Storage usado para áudios e imagens das dedicatórias.
// Mantenha esta constante em sincronia com o bucket criado no painel do Supabase.
export const BUCKET_MIDIAS = 'midias';