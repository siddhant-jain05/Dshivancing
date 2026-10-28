export type ApplicationStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'needs_changes' | 'rejected';

export type StyleLevel = { style: string; level: string };

export type PayoutType = 'bank' | 'upi';

export type CoachApplication = {
  id: string;
  user_id: string;
  status: ApplicationStatus;
  styles_taught: StyleLevel[];
  years_experience: number | null;
  intro_video_url: string | null;
  teaching_samples: string[];
  certifications: string[];
  bio: string | null;
  languages: string[];
  social_links: Record<string, string>;
  identity_verified: boolean;
  gender_on_id: string | null;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CoachProfile = {
  id: string;
  application_id: string | null;
  approved_at: string | null;
  probation: boolean;
  sessions_completed: number;
  max_group_size: number;
  is_paused: boolean;
  default_price_per_hour: number | null;
  default_min_group_size: number | null;
  default_max_group_size: number | null;
  payout_type: PayoutType | null;
  payout_details_masked: string | null;
  payout_details_encrypted: string | null;
  terms_accepted: boolean;
  terms_accepted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Venue = {
  id: string;
  coach_id: string;
  name: string;
  address: string;
  city: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type VenueMedia = {
  id: string;
  venue_id: string;
  storage_path: string;
  kind: 'image' | 'video';
  public_url: string;
  created_at: string;
};

export type CoachAvailability = {
  id: string;
  coach_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminAction = {
  id: string;
  admin_id: string;
  action_type: 'approve' | 'reject' | 'needs_changes' | 'pause' | 'resume' | 'create_venue' | 'update_venue' | 'delete_venue';
  target_user_id: string | null;
  target_application_id: string | null;
  note: string | null;
  created_at: string;
};

export interface IdentityVerifier {
  verify(idNumber: string, idType: string): Promise<{ verified: boolean; genderOnId: string }>;
}

export class StubIdentityVerifier implements IdentityVerifier {
  async verify(_idNumber: string, _idType: string): Promise<{ verified: boolean; genderOnId: string }> {
    // Dev-only stub: fails closed outside development.
    // Never stores ID images. Never sets gender_on_id or women-only eligibility in production.
    const isDev = process.env.EXPO_PUBLIC_APP_ENV === "development";
    if (!isDev) {
      throw new Error("Identity verification stub is disabled outside development");
    }
    // Stub always returns verified in dev. Gender is NOT propagated to women-only eligibility.
    return { verified: true, genderOnId: "prefer_not_to_say" };
  }
}
