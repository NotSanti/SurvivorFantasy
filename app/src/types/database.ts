export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          request_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          request_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          request_id?: string | null
        }
        Relationships: []
      }
      castaway_episode_score_revisions: {
        Row: {
          castaway_id: string
          episode_id: string
          id: string
          points_total: number
          published_at: string | null
          revision: number
          season_id: string
          source_alt_text_hash: string
          source_image_url: string | null
          source_run_id: string
          status: Database["public"]["Enums"]["score_revision_status"]
        }
        Insert: {
          castaway_id: string
          episode_id: string
          id?: string
          points_total: number
          published_at?: string | null
          revision: number
          season_id: string
          source_alt_text_hash: string
          source_image_url?: string | null
          source_run_id: string
          status: Database["public"]["Enums"]["score_revision_status"]
        }
        Update: {
          castaway_id?: string
          episode_id?: string
          id?: string
          points_total?: number
          published_at?: string | null
          revision?: number
          season_id?: string
          source_alt_text_hash?: string
          source_image_url?: string | null
          source_run_id?: string
          status?: Database["public"]["Enums"]["score_revision_status"]
        }
        Relationships: [
          {
            foreignKeyName: "castaway_episode_score_revisions_castaway_id_fkey"
            columns: ["castaway_id"]
            isOneToOne: false
            referencedRelation: "castaways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "castaway_episode_score_revisions_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "castaway_episode_score_revisions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "castaway_episode_score_revisions_source_run_id_fkey"
            columns: ["source_run_id"]
            isOneToOne: false
            referencedRelation: "score_import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      castaway_source_aliases: {
        Row: {
          castaway_id: string
          normalized_source_name: string
          season_id: string
          source_key: string
        }
        Insert: {
          castaway_id: string
          normalized_source_name: string
          season_id: string
          source_key: string
        }
        Update: {
          castaway_id?: string
          normalized_source_name?: string
          season_id?: string
          source_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "castaway_source_aliases_castaway_id_fkey"
            columns: ["castaway_id"]
            isOneToOne: false
            referencedRelation: "castaways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "castaway_source_aliases_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      castaways: {
        Row: {
          display_name: string
          eliminated_episode_number: number | null
          final_placement: number | null
          id: string
          original_tribe_id: string | null
          photo_url: string | null
          season_id: string
          slug: string
          status: Database["public"]["Enums"]["castaway_status"]
        }
        Insert: {
          display_name: string
          eliminated_episode_number?: number | null
          final_placement?: number | null
          id?: string
          original_tribe_id?: string | null
          photo_url?: string | null
          season_id: string
          slug: string
          status?: Database["public"]["Enums"]["castaway_status"]
        }
        Update: {
          display_name?: string
          eliminated_episode_number?: number | null
          final_placement?: number | null
          id?: string
          original_tribe_id?: string | null
          photo_url?: string | null
          season_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["castaway_status"]
        }
        Relationships: [
          {
            foreignKeyName: "castaways_original_tribe_id_fkey"
            columns: ["original_tribe_id"]
            isOneToOne: false
            referencedRelation: "tribes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "castaways_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      episodes: {
        Row: {
          airs_at: string | null
          episode_number: number
          id: string
          phase: Database["public"]["Enums"]["episode_phase"] | null
          published_score_revision: number | null
          season_id: string
          status: Database["public"]["Enums"]["episode_status"]
          title: string | null
        }
        Insert: {
          airs_at?: string | null
          episode_number: number
          id?: string
          phase?: Database["public"]["Enums"]["episode_phase"] | null
          published_score_revision?: number | null
          season_id: string
          status?: Database["public"]["Enums"]["episode_status"]
          title?: string | null
        }
        Update: {
          airs_at?: string | null
          episode_number?: number
          id?: string
          phase?: Database["public"]["Enums"]["episode_phase"] | null
          published_score_revision?: number | null
          season_id?: string
          status?: Database["public"]["Enums"]["episode_status"]
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "episodes_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      league_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          league_id: string
          max_uses: number | null
          revoked_at: string | null
          token_hash: string
          use_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          league_id: string
          max_uses?: number | null
          revoked_at?: string | null
          token_hash: string
          use_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          league_id?: string
          max_uses?: number | null
          revoked_at?: string | null
          token_hash?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "league_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_invites_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_members: {
        Row: {
          joined_at: string
          league_id: string
          ready_at: string | null
          role: Database["public"]["Enums"]["league_member_role"]
          status: Database["public"]["Enums"]["league_member_status"]
          user_id: string
        }
        Insert: {
          joined_at?: string
          league_id: string
          ready_at?: string | null
          role?: Database["public"]["Enums"]["league_member_role"]
          status?: Database["public"]["Enums"]["league_member_status"]
          user_id: string
        }
        Update: {
          joined_at?: string
          league_id?: string
          ready_at?: string | null
          role?: Database["public"]["Enums"]["league_member_role"]
          status?: Database["public"]["Enums"]["league_member_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          commissioner_id: string
          created_at: string
          id: string
          locked_at: string | null
          max_members: number
          name: string
          ruleset_version_id: string
          season_id: string
          selection_deadline: string | null
          selection_mode: Database["public"]["Enums"]["selection_mode"]
          status: Database["public"]["Enums"]["league_status"]
          updated_at: string
        }
        Insert: {
          commissioner_id: string
          created_at?: string
          id?: string
          locked_at?: string | null
          max_members: number
          name: string
          ruleset_version_id: string
          season_id: string
          selection_deadline?: string | null
          selection_mode?: Database["public"]["Enums"]["selection_mode"]
          status?: Database["public"]["Enums"]["league_status"]
          updated_at?: string
        }
        Update: {
          commissioner_id?: string
          created_at?: string
          id?: string
          locked_at?: string | null
          max_members?: number
          name?: string
          ruleset_version_id?: string
          season_id?: string
          selection_deadline?: string | null
          selection_mode?: Database["public"]["Enums"]["selection_mode"]
          status?: Database["public"]["Enums"]["league_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leagues_commissioner_id_fkey"
            columns: ["commissioner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leagues_ruleset_version_id_fkey"
            columns: ["ruleset_version_id"]
            isOneToOne: false
            referencedRelation: "rule_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leagues_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      merge_moves: {
        Row: {
          effective_episode: number
          id: string
          in_castaway_id: string
          league_id: string
          locked_at: string
          member_id: string
          move_type: Database["public"]["Enums"]["merge_move_type"]
          out_roster_entry_id: string | null
        }
        Insert: {
          effective_episode: number
          id?: string
          in_castaway_id: string
          league_id: string
          locked_at?: string
          member_id: string
          move_type: Database["public"]["Enums"]["merge_move_type"]
          out_roster_entry_id?: string | null
        }
        Update: {
          effective_episode?: number
          id?: string
          in_castaway_id?: string
          league_id?: string
          locked_at?: string
          member_id?: string
          move_type?: Database["public"]["Enums"]["merge_move_type"]
          out_roster_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merge_moves_in_castaway_id_fkey"
            columns: ["in_castaway_id"]
            isOneToOne: false
            referencedRelation: "castaways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merge_moves_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merge_moves_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merge_moves_out_roster_entry_id_fkey"
            columns: ["out_roster_entry_id"]
            isOneToOne: false
            referencedRelation: "roster_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      mvp_selections: {
        Row: {
          castaway_id: string
          league_id: string
          locked_at: string | null
          member_id: string
        }
        Insert: {
          castaway_id: string
          league_id: string
          locked_at?: string | null
          member_id: string
        }
        Update: {
          castaway_id?: string
          league_id?: string
          locked_at?: string | null
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mvp_selections_castaway_id_fkey"
            columns: ["castaway_id"]
            isOneToOne: false
            referencedRelation: "castaways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_selections_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_selections_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempt_count: number
          available_at: string
          dedupe_key: string
          event_type: string
          id: string
          last_error_redacted: string | null
          payload: Json
          status: Database["public"]["Enums"]["outbox_status"]
          user_id: string
        }
        Insert: {
          attempt_count?: number
          available_at?: string
          dedupe_key: string
          event_type: string
          id?: string
          last_error_redacted?: string | null
          payload: Json
          status?: Database["public"]["Enums"]["outbox_status"]
          user_id: string
        }
        Update: {
          attempt_count?: number
          available_at?: string
          dedupe_key?: string
          event_type?: string
          id?: string
          last_error_redacted?: string | null
          payload?: Json
          status?: Database["public"]["Enums"]["outbox_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          draft_deadlines: boolean
          league_updates: boolean
          merge_window: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          score_corrections: boolean
          scores_published: boolean
          timezone: string
          user_id: string
          weekly_reminder: boolean
        }
        Insert: {
          draft_deadlines?: boolean
          league_updates?: boolean
          merge_window?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          score_corrections?: boolean
          scores_published?: boolean
          timezone?: string
          user_id: string
          weekly_reminder?: boolean
        }
        Update: {
          draft_deadlines?: boolean
          league_updates?: boolean
          merge_window?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          score_corrections?: boolean
          scores_published?: boolean
          timezone?: string
          user_id?: string
          weekly_reminder?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          episode_id: string | null
          id: string
          league_id: string | null
          read_at: string | null
          route: string
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          episode_id?: string | null
          id?: string
          league_id?: string | null
          read_at?: string | null
          route: string
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          episode_id?: string | null
          id?: string
          league_id?: string | null
          read_at?: string | null
          route?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          display_name: string
          id: string
          onboarding_completed_at: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          display_name: string
          id: string
          onboarding_completed_at?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string
          id?: string
          onboarding_completed_at?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device_label: string | null
          endpoint: string
          endpoint_hash: string
          id: string
          last_seen_at: string
          p256dh: string
          revoked_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          device_label?: string | null
          endpoint: string
          endpoint_hash: string
          id?: string
          last_seen_at?: string
          p256dh: string
          revoked_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          device_label?: string | null
          endpoint?: string
          endpoint_hash?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_entries: {
        Row: {
          acquisition_type: Database["public"]["Enums"]["roster_acquisition_type"]
          castaway_id: string
          created_at: string
          ends_episode: number | null
          id: string
          league_id: string
          locked_at: string | null
          member_id: string
          picked_at: string
          replaces_roster_entry_id: string | null
          slot_number: number
          starts_episode: number
        }
        Insert: {
          acquisition_type: Database["public"]["Enums"]["roster_acquisition_type"]
          castaway_id: string
          created_at?: string
          ends_episode?: number | null
          id?: string
          league_id: string
          locked_at?: string | null
          member_id: string
          picked_at?: string
          replaces_roster_entry_id?: string | null
          slot_number: number
          starts_episode: number
        }
        Update: {
          acquisition_type?: Database["public"]["Enums"]["roster_acquisition_type"]
          castaway_id?: string
          created_at?: string
          ends_episode?: number | null
          id?: string
          league_id?: string
          locked_at?: string | null
          member_id?: string
          picked_at?: string
          replaces_roster_entry_id?: string | null
          slot_number?: number
          starts_episode?: number
        }
        Relationships: [
          {
            foreignKeyName: "roster_entries_castaway_id_fkey"
            columns: ["castaway_id"]
            isOneToOne: false
            referencedRelation: "castaways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_entries_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_entries_replaces_roster_entry_id_fkey"
            columns: ["replaces_roster_entry_id"]
            isOneToOne: false
            referencedRelation: "roster_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_sets: {
        Row: {
          effective_from_episode: number
          first_scored_episode: number
          id: string
          parser_version: string
          pending_confirmation: boolean
          picks_per_original_tribe: Json
          roster_size: number
          season_id: string
          source_hash: string
          source_modified_at: string | null
          source_url: string
          status: Database["public"]["Enums"]["rule_set_status"]
          version: number
          wildcard_slots: number
        }
        Insert: {
          effective_from_episode?: number
          first_scored_episode: number
          id?: string
          parser_version?: string
          pending_confirmation?: boolean
          picks_per_original_tribe: Json
          roster_size: number
          season_id: string
          source_hash: string
          source_modified_at?: string | null
          source_url: string
          status?: Database["public"]["Enums"]["rule_set_status"]
          version: number
          wildcard_slots?: number
        }
        Update: {
          effective_from_episode?: number
          first_scored_episode?: number
          id?: string
          parser_version?: string
          pending_confirmation?: boolean
          picks_per_original_tribe?: Json
          roster_size?: number
          season_id?: string
          source_hash?: string
          source_modified_at?: string | null
          source_url?: string
          status?: Database["public"]["Enums"]["rule_set_status"]
          version?: number
          wildcard_slots?: number
        }
        Relationships: [
          {
            foreignKeyName: "rule_sets_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_sync_runs: {
        Row: {
          error_code: string | null
          error_detail_redacted: string | null
          finished_at: string | null
          http_status: number | null
          id: string
          parser_version: string
          proposed_rule_set_id: string | null
          season_id: string
          source_hash: string | null
          source_modified_at: string | null
          source_post_id: number | null
          source_url: string | null
          started_at: string
          status: Database["public"]["Enums"]["rule_sync_status"]
          trigger_type: Database["public"]["Enums"]["import_trigger_type"]
        }
        Insert: {
          error_code?: string | null
          error_detail_redacted?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          parser_version?: string
          proposed_rule_set_id?: string | null
          season_id: string
          source_hash?: string | null
          source_modified_at?: string | null
          source_post_id?: number | null
          source_url?: string | null
          started_at?: string
          status: Database["public"]["Enums"]["rule_sync_status"]
          trigger_type?: Database["public"]["Enums"]["import_trigger_type"]
        }
        Update: {
          error_code?: string | null
          error_detail_redacted?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          parser_version?: string
          proposed_rule_set_id?: string | null
          season_id?: string
          source_hash?: string | null
          source_modified_at?: string | null
          source_post_id?: number | null
          source_url?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["rule_sync_status"]
          trigger_type?: Database["public"]["Enums"]["import_trigger_type"]
        }
        Relationships: [
          {
            foreignKeyName: "rule_sync_runs_proposed_rule_set_id_fkey"
            columns: ["proposed_rule_set_id"]
            isOneToOne: false
            referencedRelation: "rule_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_sync_runs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      score_events: {
        Row: {
          evidence_note: string | null
          occurrences: number
          points: number
          score_revision_id: string
          scoring_rule_id: string
        }
        Insert: {
          evidence_note?: string | null
          occurrences?: number
          points: number
          score_revision_id: string
          scoring_rule_id: string
        }
        Update: {
          evidence_note?: string | null
          occurrences?: number
          points?: number
          score_revision_id?: string
          scoring_rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_events_score_revision_id_fkey"
            columns: ["score_revision_id"]
            isOneToOne: false
            referencedRelation: "castaway_episode_score_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_events_score_revision_id_fkey"
            columns: ["score_revision_id"]
            isOneToOne: false
            referencedRelation: "published_castaway_episode_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_events_scoring_rule_id_fkey"
            columns: ["scoring_rule_id"]
            isOneToOne: false
            referencedRelation: "scoring_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      score_import_runs: {
        Row: {
          error_code: string | null
          error_detail_redacted: string | null
          finished_at: string | null
          http_status: number | null
          id: string
          parser_version: string
          season_id: string
          source_etag: string | null
          source_hash: string | null
          source_modified_at: string | null
          source_post_id: number | null
          source_url: string
          started_at: string
          status: Database["public"]["Enums"]["import_status"]
          summary: Json | null
          trigger_type: Database["public"]["Enums"]["import_trigger_type"]
        }
        Insert: {
          error_code?: string | null
          error_detail_redacted?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          parser_version: string
          season_id: string
          source_etag?: string | null
          source_hash?: string | null
          source_modified_at?: string | null
          source_post_id?: number | null
          source_url: string
          started_at?: string
          status?: Database["public"]["Enums"]["import_status"]
          summary?: Json | null
          trigger_type: Database["public"]["Enums"]["import_trigger_type"]
        }
        Update: {
          error_code?: string | null
          error_detail_redacted?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          parser_version?: string
          season_id?: string
          source_etag?: string | null
          source_hash?: string | null
          source_modified_at?: string | null
          source_post_id?: number | null
          source_url?: string
          started_at?: string
          status?: Database["public"]["Enums"]["import_status"]
          summary?: Json | null
          trigger_type?: Database["public"]["Enums"]["import_trigger_type"]
        }
        Relationships: [
          {
            foreignKeyName: "score_import_runs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_rules: {
        Row: {
          code: string
          id: string
          kind: Database["public"]["Enums"]["scoring_rule_kind"]
          label: string
          max_occurrences_per_castaway_episode: number | null
          phase: Database["public"]["Enums"]["scoring_phase"]
          points: number
          rule_set_id: string
          sort_order: number
        }
        Insert: {
          code: string
          id?: string
          kind: Database["public"]["Enums"]["scoring_rule_kind"]
          label: string
          max_occurrences_per_castaway_episode?: number | null
          phase?: Database["public"]["Enums"]["scoring_phase"]
          points: number
          rule_set_id: string
          sort_order: number
        }
        Update: {
          code?: string
          id?: string
          kind?: Database["public"]["Enums"]["scoring_rule_kind"]
          label?: string
          max_occurrences_per_castaway_episode?: number | null
          phase?: Database["public"]["Enums"]["scoring_phase"]
          points?: number
          rule_set_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "scoring_rules_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          finale_episode_number: number | null
          first_scored_episode: number | null
          id: string
          merge_episode_number: number | null
          name: string
          number: number
          premiere_at: string | null
          source_checked_at: string | null
          source_page_url: string | null
          source_wp_post_id: number | null
          status: Database["public"]["Enums"]["season_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          finale_episode_number?: number | null
          first_scored_episode?: number | null
          id?: string
          merge_episode_number?: number | null
          name: string
          number: number
          premiere_at?: string | null
          source_checked_at?: string | null
          source_page_url?: string | null
          source_wp_post_id?: number | null
          status?: Database["public"]["Enums"]["season_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          finale_episode_number?: number | null
          first_scored_episode?: number | null
          id?: string
          merge_episode_number?: number | null
          name?: string
          number?: number
          premiere_at?: string | null
          source_checked_at?: string | null
          source_page_url?: string | null
          source_wp_post_id?: number | null
          status?: Database["public"]["Enums"]["season_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      selection_sessions: {
        Row: {
          league_id: string
          locked_at: string | null
          rule_set_id: string
          started_at: string
        }
        Insert: {
          league_id: string
          locked_at?: string | null
          rule_set_id: string
          started_at?: string
        }
        Update: {
          league_id?: string
          locked_at?: string | null
          rule_set_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "selection_sessions_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: true
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selection_sessions_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      tribes: {
        Row: {
          color_name: string | null
          color_token: string | null
          id: string
          name: string
          season_id: string
          sort_order: number
        }
        Insert: {
          color_name?: string | null
          color_token?: string | null
          id?: string
          name: string
          season_id: string
          sort_order: number
        }
        Update: {
          color_name?: string | null
          color_token?: string | null
          id?: string
          name?: string
          season_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "tribes_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      wildcard_audits: {
        Row: {
          algorithm_version: string
          created_at: string
          eligible_castaway_ids: string[]
          id: string
          idempotency_key: string
          league_id: string
          member_id: string
          seed_hash: string
          selected_castaway_id: string
        }
        Insert: {
          algorithm_version: string
          created_at?: string
          eligible_castaway_ids: string[]
          id?: string
          idempotency_key: string
          league_id: string
          member_id: string
          seed_hash: string
          selected_castaway_id: string
        }
        Update: {
          algorithm_version?: string
          created_at?: string
          eligible_castaway_ids?: string[]
          id?: string
          idempotency_key?: string
          league_id?: string
          member_id?: string
          seed_hash?: string
          selected_castaway_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wildcard_audits_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wildcard_audits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wildcard_audits_selected_castaway_id_fkey"
            columns: ["selected_castaway_id"]
            isOneToOne: false
            referencedRelation: "castaways"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      league_standings: {
        Row: {
          display_name: string | null
          league_id: string | null
          member_id: string | null
          rank: number | null
          total_points: number | null
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_members_user_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_cumulative_scores: {
        Row: {
          league_id: string | null
          member_id: string | null
          total_points: number | null
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_members_user_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_episode_castaway_scores: {
        Row: {
          acquisition_type:
            | Database["public"]["Enums"]["roster_acquisition_type"]
            | null
          castaway_id: string | null
          ends_episode: number | null
          episode_id: string | null
          episode_number: number | null
          is_mvp_bonus: boolean | null
          league_id: string | null
          member_id: string | null
          points_total: number | null
          published_at: string | null
          revision: number | null
          roster_entry_id: string | null
          starts_episode: number | null
        }
        Relationships: []
      }
      member_episode_scores: {
        Row: {
          episode_id: string | null
          episode_number: number | null
          league_id: string | null
          member_id: string | null
          points: number | null
        }
        Relationships: []
      }
      published_castaway_episode_scores: {
        Row: {
          castaway_id: string | null
          episode_id: string | null
          episode_number: number | null
          id: string | null
          points_total: number | null
          published_at: string | null
          revision: number | null
          season_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "castaway_episode_score_revisions_castaway_id_fkey"
            columns: ["castaway_id"]
            isOneToOne: false
            referencedRelation: "castaways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "castaway_episode_score_revisions_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "castaway_episode_score_revisions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_league_invite: {
        Args: { p_token: string }
        Returns: {
          commissioner_id: string
          created_at: string
          id: string
          locked_at: string | null
          max_members: number
          name: string
          ruleset_version_id: string
          season_id: string
          selection_deadline: string | null
          selection_mode: Database["public"]["Enums"]["selection_mode"]
          status: Database["public"]["Enums"]["league_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "leagues"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_ops_health: { Args: never; Returns: Json }
      archive_league: { Args: { p_league_id: string }; Returns: undefined }
      claim_first_admin: { Args: never; Returns: boolean }
      claim_notification_outbox: {
        Args: { p_limit: number }
        Returns: {
          attempt_count: number
          available_at: string
          dedupe_key: string
          event_type: string
          id: string
          last_error_redacted: string | null
          payload: Json
          status: Database["public"]["Enums"]["outbox_status"]
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      close_merge_window: { Args: { p_league_id: string }; Returns: undefined }
      complete_notification_outbox: {
        Args: {
          p_available_at?: string
          p_error_redacted?: string
          p_id: string
          p_status: Database["public"]["Enums"]["outbox_status"]
        }
        Returns: undefined
      }
      complete_onboarding: {
        Args: { p_display_name: string }
        Returns: {
          avatar_path: string | null
          created_at: string
          display_name: string
          id: string
          onboarding_completed_at: string | null
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_rule_set: {
        Args: { p_rule_set_id: string }
        Returns: {
          effective_from_episode: number
          first_scored_episode: number
          id: string
          parser_version: string
          pending_confirmation: boolean
          picks_per_original_tribe: Json
          roster_size: number
          season_id: string
          source_hash: string
          source_modified_at: string | null
          source_url: string
          status: Database["public"]["Enums"]["rule_set_status"]
          version: number
          wildcard_slots: number
        }
        SetofOptions: {
          from: "*"
          to: "rule_sets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_league: {
        Args: { p_max_members?: number; p_name: string }
        Returns: {
          commissioner_id: string
          created_at: string
          id: string
          locked_at: string | null
          max_members: number
          name: string
          ruleset_version_id: string
          season_id: string
          selection_deadline: string | null
          selection_mode: Database["public"]["Enums"]["selection_mode"]
          status: Database["public"]["Enums"]["league_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "leagues"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_league_invite: {
        Args: {
          p_expires_in_hours?: number
          p_league_id: string
          p_max_uses?: number
        }
        Returns: string
      }
      create_score_import_run: {
        Args: {
          p_season_id: string
          p_source_url: string
          p_trigger_type: Database["public"]["Enums"]["import_trigger_type"]
        }
        Returns: string
      }
      delete_castaway_alias: {
        Args: {
          p_normalized_source_name: string
          p_season_id: string
          p_source_key: string
        }
        Returns: undefined
      }
      enqueue_score_notifications: {
        Args: { p_episode_id: string; p_kind: string }
        Returns: undefined
      }
      finish_score_import_run: {
        Args: {
          p_error_code?: string
          p_error_detail?: string
          p_http_status?: number
          p_run_id: string
          p_source_hash?: string
          p_status: Database["public"]["Enums"]["import_status"]
          p_summary: Json
        }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      leave_league: { Args: { p_league_id: string }; Returns: undefined }
      lock_league_selection: {
        Args: { p_league_id: string }
        Returns: undefined
      }
      mark_castaway_eliminated: {
        Args: { p_castaway_id: string; p_episode_number: number }
        Returns: undefined
      }
      mark_notifications_read: { Args: { p_ids: string[] }; Returns: undefined }
      publish_episode_scores: {
        Args: {
          p_episode_number: number
          p_run_id: string
          p_scores: Json
          p_season_id: string
          p_source_alt_text_hash: string
          p_source_image_url: string
        }
        Returns: Json
      }
      register_push_subscription: {
        Args: {
          p_auth: string
          p_device_label?: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent?: string
        }
        Returns: {
          auth: string
          created_at: string
          device_label: string | null
          endpoint: string
          endpoint_hash: string
          id: string
          last_seen_at: string
          p256dh: string
          revoked_at: string | null
          user_agent: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "push_subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_wildcard: {
        Args: { p_idempotency_key: string; p_league_id: string }
        Returns: Json
      }
      request_wildcard_unthrottled: {
        Args: { p_idempotency_key: string; p_league_id: string }
        Returns: Json
      }
      revoke_league_invite: {
        Args: { p_invite_id: string }
        Returns: undefined
      }
      revoke_push_endpoint: { Args: { p_endpoint: string }; Returns: undefined }
      revoke_push_subscription: {
        Args: { p_endpoint: string }
        Returns: undefined
      }
      save_manual_picks: {
        Args: { p_castaway_ids: string[]; p_league_id: string }
        Returns: undefined
      }
      set_league_ready: {
        Args: { p_league_id: string; p_ready: boolean }
        Returns: undefined
      }
      set_mvp: {
        Args: { p_castaway_id: string; p_league_id: string }
        Returns: undefined
      }
      set_season_merge_episode: {
        Args: { p_episode_number: number; p_season_id: string }
        Returns: undefined
      }
      start_league_selection: {
        Args: { p_league_id: string }
        Returns: undefined
      }
      submit_merge_move: {
        Args: {
          p_in_castaway_id: string
          p_league_id: string
          p_out_roster_entry_id?: string
        }
        Returns: {
          effective_episode: number
          id: string
          in_castaway_id: string
          league_id: string
          locked_at: string
          member_id: string
          move_type: Database["public"]["Enums"]["merge_move_type"]
          out_roster_entry_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "merge_moves"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_castaway_alias: {
        Args: {
          p_castaway_id: string
          p_normalized_source_name: string
          p_season_id: string
          p_source_key: string
        }
        Returns: undefined
      }
    }
    Enums: {
      castaway_status: "active" | "eliminated" | "withdrawn"
      episode_phase: "pre_merge" | "merge" | "post_merge" | "finale"
      episode_status:
        | "scheduled"
        | "results_pending"
        | "parsed"
        | "published"
        | "corrected"
        | "needs_review"
      import_status:
        | "started"
        | "succeeded"
        | "noop"
        | "needs_review"
        | "failed"
      import_trigger_type: "schedule" | "manual" | "retry"
      league_member_role: "commissioner" | "member"
      league_member_status: "active" | "left" | "removed"
      league_status:
        | "recruiting"
        | "selecting"
        | "locked"
        | "active_pre_merge"
        | "merge_window"
        | "active_post_merge"
        | "finished"
        | "archived"
      merge_move_type: "add" | "swap"
      outbox_status: "pending" | "processing" | "sent" | "dead_letter"
      roster_acquisition_type:
        | "manual"
        | "wildcard"
        | "merge_add"
        | "merge_swap_in"
      rule_set_status: "draft" | "confirmed" | "retired"
      rule_sync_status:
        | "not_published_yet"
        | "noop"
        | "draft_created"
        | "parse_failed"
        | "fetch_failed"
      score_revision_status: "parsed" | "published" | "superseded"
      scoring_phase: "pre_merge" | "post_merge" | "finale" | "any"
      scoring_rule_kind: "survival" | "weekly_category" | "placement" | "mvp"
      season_status: "upcoming" | "active" | "finished" | "archived"
      selection_mode: "global_shared_pool" | "exclusive_snake"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      castaway_status: ["active", "eliminated", "withdrawn"],
      episode_phase: ["pre_merge", "merge", "post_merge", "finale"],
      episode_status: [
        "scheduled",
        "results_pending",
        "parsed",
        "published",
        "corrected",
        "needs_review",
      ],
      import_status: ["started", "succeeded", "noop", "needs_review", "failed"],
      import_trigger_type: ["schedule", "manual", "retry"],
      league_member_role: ["commissioner", "member"],
      league_member_status: ["active", "left", "removed"],
      league_status: [
        "recruiting",
        "selecting",
        "locked",
        "active_pre_merge",
        "merge_window",
        "active_post_merge",
        "finished",
        "archived",
      ],
      merge_move_type: ["add", "swap"],
      outbox_status: ["pending", "processing", "sent", "dead_letter"],
      roster_acquisition_type: [
        "manual",
        "wildcard",
        "merge_add",
        "merge_swap_in",
      ],
      rule_set_status: ["draft", "confirmed", "retired"],
      rule_sync_status: [
        "not_published_yet",
        "noop",
        "draft_created",
        "parse_failed",
        "fetch_failed",
      ],
      score_revision_status: ["parsed", "published", "superseded"],
      scoring_phase: ["pre_merge", "post_merge", "finale", "any"],
      scoring_rule_kind: ["survival", "weekly_category", "placement", "mvp"],
      season_status: ["upcoming", "active", "finished", "archived"],
      selection_mode: ["global_shared_pool", "exclusive_snake"],
    },
  },
} as const
