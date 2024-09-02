/**
 * @schema AdminInventoryLevel
 * type: object
 * description: The location level's location levels.
 * x-schemaName: AdminInventoryLevel
 * required:
 *   - id
 *   - created_at
 *   - updated_at
 *   - deleted_at
 *   - inventory_item_id
 *   - location_id
 *   - stocked_quantity
 *   - raw_stocked_quantity
 *   - reserved_quantity
 *   - raw_reserved_quantity
 *   - incoming_quantity
 *   - raw_incoming_quantity
 *   - metadata
 *   - available_quantity
 * properties:
 *   id:
 *     type: string
 *     title: id
 *     description: The location level's ID.
 *   created_at:
 *     type: string
 *     format: date-time
 *     title: created_at
 *     description: The location level's created at.
 *   updated_at:
 *     type: string
 *     format: date-time
 *     title: updated_at
 *     description: The location level's updated at.
 *   deleted_at:
 *     type: string
 *     format: date-time
 *     title: deleted_at
 *     description: The location level's deleted at.
 *   inventory_item_id:
 *     type: string
 *     title: inventory_item_id
 *     description: The location level's inventory item id.
 *   location_id:
 *     type: string
 *     title: location_id
 *     description: The location level's location id.
 *   stocked_quantity:
 *     type: number
 *     title: stocked_quantity
 *     description: The location level's stocked quantity.
 *   raw_stocked_quantity:
 *     type: object
 *     description: The location level's raw stocked quantity.
 *   reserved_quantity:
 *     type: number
 *     title: reserved_quantity
 *     description: The location level's reserved quantity.
 *   raw_reserved_quantity:
 *     type: object
 *     description: The location level's raw reserved quantity.
 *   incoming_quantity:
 *     type: number
 *     title: incoming_quantity
 *     description: The location level's incoming quantity.
 *   raw_incoming_quantity:
 *     type: object
 *     description: The location level's raw incoming quantity.
 *   metadata:
 *     type: object
 *     description: The location level's metadata.
 *   inventory_item:
 *     $ref: "#/components/schemas/AdminInventoryItem"
 *   available_quantity:
 *     type: number
 *     title: available_quantity
 *     description: The location level's available quantity.
 * 
*/
