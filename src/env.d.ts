interface ImportMetaEnv {
    readonly VITE_SUPABASE_ANON_KEY?: string;
    readonly VITE_COMMUNITY_SERVERS_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}