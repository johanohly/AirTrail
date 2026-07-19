-- RenameTable
ALTER TABLE "seat" RENAME TO "flight_passenger";

-- RenameSequence
ALTER SEQUENCE "seat_id_seq" RENAME TO "flight_passenger_id_seq";

-- RenameConstraints
ALTER TABLE "flight_passenger"
  RENAME CONSTRAINT "seat_pkey" TO "flight_passenger_pkey";
ALTER TABLE "flight_passenger"
  RENAME CONSTRAINT "seat_user_id_fkey" TO "flight_passenger_user_id_fkey";
ALTER TABLE "flight_passenger"
  RENAME CONSTRAINT "seat_flight_id_fkey" TO "flight_passenger_flight_id_fkey";

-- RenameIndexes
ALTER INDEX "seat_user_id_flight_id_key"
  RENAME TO "flight_passenger_user_id_flight_id_key";
ALTER INDEX "seat_flight_id_guest_name_key"
  RENAME TO "flight_passenger_flight_id_guest_name_key";
