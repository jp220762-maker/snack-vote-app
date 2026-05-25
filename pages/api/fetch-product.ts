import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type SnackItem = {
  id: string
  session_id: string
  name: string
  price: number | null
  store: string | null
  url: string | null
  image_url: string | null
  type: 'snack' | 'drink'
  created_at: string
  vote_count: number
}

export type VoteSession = {
  id: string
  title: string
  is_open: boolean
  created_at: string
  closed_at: string | null
}
