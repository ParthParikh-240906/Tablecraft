export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface OrderRecord {
  id: string;
  customer_name: string;
  total: number;
  status: string;
  created_at: string;
  stripe_session_id?: string | null;
  items: OrderItem[];
  parent_order_id?: string | null;
}
