export type OrderType = 'dine-in' | 'takeout'
export type OrderStatus = 'pending' | 'printed' | 'completed' | 'cancelled'
export type CreatedBy = 'customer' | 'staff'

export interface Category {
  id: string
  name: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface MenuItem {
  id: string
  category_id: string | null
  name: string
  price: number
  description: string | null
  is_available: boolean
  sort_order: number
  created_at: string
  category?: Category
}

export interface OrderItem {
  id: string
  order_id: string
  item_id: string | null
  item_name: string
  item_price: number
  quantity: number
  item_note: string | null
  created_at: string
}

export interface Order {
  id: string
  order_number: number
  order_type: OrderType
  table_number: string | null
  pickup_number: string | null
  status: OrderStatus
  customer_note: string | null
  subtotal: number
  created_by: CreatedBy
  created_at: string
  printed_at: string | null
  completed_at: string | null
  order_items?: OrderItem[]
}

export interface CartItem {
  item_id: string
  item_name: string
  item_price: number
  quantity: number
  item_note: string
}

export interface CreateOrderPayload {
  order_type: OrderType
  table_number?: string
  pickup_number?: string
  customer_note?: string
  created_by: CreatedBy
  items: {
    item_id: string
    item_name: string
    item_price: number
    quantity: number
    item_note?: string
  }[]
  idempotency_key: string
}
