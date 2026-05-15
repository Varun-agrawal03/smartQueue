export interface EventType {
  id:              string;
  title:           string;
  venue:           string;
  description:     string;
  event_date:      string;
  total_seats:     number;
  available_seats?: number;
  base_price:      number;
  current_price:   number;
  demand_score:    number;
  status:          string;
  category:        string;
  thumbnail_url:   string;
  artist_or_team:  string;
}

export interface Seat {
  id:           string;
  seat_number:  string;
  row_label:    string;
  status:       "available" | "locked" | "booked";
  locked_until: string | null;
}

export interface Booking {
  id:               string;
  price_paid:       number;
  status:           string;
  booked_at:        string;
  event_title:      string;
  venue:            string;
  event_date:       string;
  seat_number:      string;
  row_label:        string;
  booking_group_id: string;
}

export interface User {
  id:         string;
  name:       string;
  email:      string;
  created_at: string;
}

export interface AuthResponse {
  message: string;
  user:    User;
  token:   string;
}