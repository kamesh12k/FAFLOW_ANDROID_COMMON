import math
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.campus_geofence import CampusGeofence
from app.models.audit_log import AuditLog
from app.schemas.geofence import GeofenceCreate, GeofenceUpdate

EARTH_RADIUS_METERS = 6371000.0


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two coordinates in meters."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_METERS * c


def compute_polygon_metrics(vertices: List[List[float]]) -> Tuple[float, float, float, float, float]:
    """
    Computes (center_lat, center_lon, radius_meters, area_sq_m, perimeter_m) for a polygon.
    """
    if len(vertices) < 3:
        raise ValueError("Polygon must have at least 3 vertices")

    # 1. Compute Centroid
    avg_lat = sum(v[0] for v in vertices) / len(vertices)
    avg_lon = sum(v[1] for v in vertices) / len(vertices)

    # 2. Compute Perimeter
    perimeter = 0.0
    max_radius_from_center = 0.0
    n = len(vertices)

    for i in range(n):
        v1 = vertices[i]
        v2 = vertices[(i + 1) % n]
        edge_len = haversine_distance_meters(v1[0], v1[1], v2[0], v2[1])
        perimeter += edge_len

        dist_to_center = haversine_distance_meters(avg_lat, avg_lon, v1[0], v1[1])
        if dist_to_center > max_radius_from_center:
            max_radius_from_center = dist_to_center

    # 3. Compute Geodesic Polygon Area (using Equirectangular Projection approximation)
    # x = lon * cos(avg_lat) in meters, y = lat in meters
    lat_to_m = (math.pi / 180.0) * EARTH_RADIUS_METERS
    lon_to_m = (math.pi / 180.0) * EARTH_RADIUS_METERS * math.cos(math.radians(avg_lat))

    pts = [(v[1] * lon_to_m, v[0] * lat_to_m) for v in vertices]
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1]
    area = abs(area) / 2.0

    if area <= 1.0:
        raise ValueError("Polygon area must be strictly greater than 1 square meter")

    return avg_lat, avg_lon, max_radius_from_center, area, perimeter


class GeofenceService:

    @staticmethod
    def list_geofences(db: Session, is_active_only: bool = False) -> List[CampusGeofence]:
        query = db.query(CampusGeofence)
        if is_active_only:
            query = query.filter(CampusGeofence.is_active == True)
        return query.order_by(CampusGeofence.name.asc()).all()

    @staticmethod
    def get_geofence_by_id(db: Session, geofence_id: int) -> CampusGeofence:
        geofence = db.query(CampusGeofence).filter(CampusGeofence.id == geofence_id).first()
        if not geofence:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Campus geofence with ID {geofence_id} not found"
            )
        return geofence

    @staticmethod
    def create_geofence(db: Session, data: GeofenceCreate, user_id: Optional[int]) -> CampusGeofence:
        # Check for duplicate name
        existing = db.query(CampusGeofence).filter(CampusGeofence.name.ilike(data.name.strip())).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A campus geofence named '{data.name.strip()}' already exists"
            )

        if data.type == "circle":
            if data.center_latitude is None or data.center_longitude is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Circle geofences require center_latitude and center_longitude"
                )
            radius = data.radius_meters or 150.0
            if radius <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Circle radius must be strictly positive"
                )

            area = math.pi * (radius ** 2)
            perimeter = 2.0 * math.pi * radius
            center_lat = data.center_latitude
            center_lon = data.center_longitude
            geometry = {
                "type": "Point",
                "coordinates": [center_lat, center_lon],
                "radius": radius,
                "tolerance": data.tolerance_meters
            }

        elif data.type == "polygon":
            if not data.polygon_vertices or len(data.polygon_vertices) < 3:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Polygon geofences require at least 3 distinct vertices"
                )
            try:
                center_lat, center_lon, radius, area, perimeter = compute_polygon_metrics(data.polygon_vertices)
            except ValueError as e:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

            geometry = {
                "type": "Polygon",
                "coordinates": data.polygon_vertices,
                "tolerance": data.tolerance_meters
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported geofence type: {data.type}"
            )

        geofence = CampusGeofence(
            name=data.name.strip(),
            description=data.description.strip() if data.description else None,
            type=data.type,
            center_latitude=center_lat,
            center_longitude=center_lon,
            radius_meters=radius,
            geometry=geometry,
            tolerance_meters=data.tolerance_meters,
            area_sq_meters=area,
            perimeter_meters=perimeter,
            is_active=True,
            created_by=user_id,
            updated_by=user_id
        )

        db.add(geofence)
        db.flush()

        # Audit Log
        audit = AuditLog(
            actor_user_id=user_id,
            action="CREATE_CAMPUS_GEOFENCE",
            target_type="campus_geofence",
            target_id=geofence.id,
            details={
                "name": geofence.name,
                "type": geofence.type,
                "center": [center_lat, center_lon],
                "radius_meters": radius,
                "area_sq_meters": area
            }
        )
        db.add(audit)
        db.commit()
        db.refresh(geofence)
        return geofence

    @staticmethod
    def update_geofence(db: Session, geofence_id: int, data: GeofenceUpdate, user_id: Optional[int]) -> CampusGeofence:
        geofence = GeofenceService.get_geofence_by_id(db, geofence_id)

        if data.name and data.name.strip() != geofence.name:
            dup = db.query(CampusGeofence).filter(
                CampusGeofence.name.ilike(data.name.strip()),
                CampusGeofence.id != geofence_id
            ).first()
            if dup:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"A campus geofence named '{data.name.strip()}' already exists"
                )
            geofence.name = data.name.strip()

        if data.description is not None:
            geofence.description = data.description.strip() if data.description else None

        if data.tolerance_meters is not None:
            geofence.tolerance_meters = data.tolerance_meters

        if data.is_active is not None:
            geofence.is_active = data.is_active

        # Check geometry update
        target_type = data.type or geofence.type
        if data.type or data.polygon_vertices or (data.center_latitude and data.center_longitude) or data.radius_meters is not None:
            geofence.type = target_type
            if target_type == "circle":
                center_lat = data.center_latitude if data.center_latitude is not None else geofence.center_latitude
                center_lon = data.center_longitude if data.center_longitude is not None else geofence.center_longitude
                radius = data.radius_meters if data.radius_meters is not None else geofence.radius_meters

                if radius <= 0:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Radius must be > 0")

                geofence.center_latitude = center_lat
                geofence.center_longitude = center_lon
                geofence.radius_meters = radius
                geofence.area_sq_meters = math.pi * (radius ** 2)
                geofence.perimeter_meters = 2.0 * math.pi * radius
                geofence.geometry = {
                    "type": "Point",
                    "coordinates": [center_lat, center_lon],
                    "radius": radius,
                    "tolerance": geofence.tolerance_meters
                }
            elif target_type == "polygon":
                vertices = data.polygon_vertices
                if not vertices:
                    vertices = geofence.geometry.get("coordinates", [])
                if len(vertices) < 3:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Polygon requires >= 3 vertices")

                try:
                    c_lat, c_lon, rad, area, perim = compute_polygon_metrics(vertices)
                except ValueError as e:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

                geofence.center_latitude = c_lat
                geofence.center_longitude = c_lon
                geofence.radius_meters = rad
                geofence.area_sq_meters = area
                geofence.perimeter_meters = perim
                geofence.geometry = {
                    "type": "Polygon",
                    "coordinates": vertices,
                    "tolerance": geofence.tolerance_meters
                }

        geofence.updated_by = user_id
        db.flush()

        audit = AuditLog(
            actor_user_id=user_id,
            action="UPDATE_CAMPUS_GEOFENCE",
            target_type="campus_geofence",
            target_id=geofence.id,
            details={"name": geofence.name, "is_active": geofence.is_active}
        )
        db.add(audit)
        db.commit()
        db.refresh(geofence)
        return geofence

    @staticmethod
    def toggle_geofence(db: Session, geofence_id: int, is_active: bool, user_id: Optional[int]) -> CampusGeofence:
        geofence = GeofenceService.get_geofence_by_id(db, geofence_id)
        geofence.is_active = is_active
        geofence.updated_by = user_id

        audit = AuditLog(
            actor_user_id=user_id,
            action="TOGGLE_CAMPUS_GEOFENCE",
            target_type="campus_geofence",
            target_id=geofence.id,
            details={"is_active": is_active}
        )
        db.add(audit)
        db.commit()
        db.refresh(geofence)
        return geofence

    @staticmethod
    def delete_geofence(db: Session, geofence_id: int, user_id: Optional[int]) -> Dict[str, str]:
        geofence = GeofenceService.get_geofence_by_id(db, geofence_id)

        # Soft-delete / Deactivate to preserve historical integrity
        geofence.is_active = False
        geofence.updated_by = user_id

        audit = AuditLog(
            actor_user_id=user_id,
            action="DEACTIVATE_CAMPUS_GEOFENCE",
            target_type="campus_geofence",
            target_id=geofence.id,
            details={"action": "soft_delete_deactivate", "name": geofence.name}
        )
        db.add(audit)
        db.commit()
        return {"message": f"Geofence '{geofence.name}' deactivated successfully"}

    @staticmethod
    def test_location(db: Session, lat: float, lon: float, accuracy_meters: float = 5.0) -> Dict[str, Any]:
        active_geofences = GeofenceService.list_geofences(db, is_active_only=True)
        if not active_geofences:
            return {
                "is_inside": False,
                "status": "NO_ACTIVE_GEOFENCES",
                "message": "No active campus geofences configured in the system.",
                "nearest_geofence_name": None,
                "nearest_geofence_type": None,
                "distance_to_boundary_meters": 0.0,
                "distance_to_center_meters": 0.0,
                "accuracy_meters": accuracy_meters
            }

        best_geofence = None
        min_dist_to_center = float("inf")
        is_inside_any = False
        nearest_boundary_dist = float("inf")

        for g in active_geofences:
            dist_to_center = haversine_distance_meters(lat, lon, g.center_latitude, g.center_longitude)
            if dist_to_center < min_dist_to_center:
                min_dist_to_center = dist_to_center
                best_geofence = g

            if g.type == "circle":
                effective_radius = g.radius_meters + g.tolerance_meters
                if dist_to_center <= effective_radius:
                    is_inside_any = True
                    dist_to_boundary = abs(dist_to_center - g.radius_meters)
                    if dist_to_boundary < nearest_boundary_dist:
                        nearest_boundary_dist = dist_to_boundary
                        best_geofence = g
                else:
                    dist_to_boundary = dist_to_center - g.radius_meters
                    if dist_to_boundary < nearest_boundary_dist:
                        nearest_boundary_dist = dist_to_boundary
            elif g.type == "polygon":
                vertices = g.geometry.get("coordinates", [])
                if vertices and len(vertices) >= 3:
                    if is_point_in_polygon(lat, lon, vertices):
                        is_inside_any = True
                        nearest_boundary_dist = 0.0
                        best_geofence = g
                    else:
                        # compute min distance to vertices
                        poly_min_dist = min(haversine_distance_meters(lat, lon, v[0], v[1]) for v in vertices)
                        if poly_min_dist < nearest_boundary_dist:
                            nearest_boundary_dist = poly_min_dist

        if is_inside_any:
            status_str = "INSIDE_CAMPUS"
            msg = f"Coordinate is inside campus boundary '{best_geofence.name}' (Accuracy: ±{accuracy_meters:.1f}m)."
        else:
            status_str = "OUTSIDE_CAMPUS"
            msg = f"Coordinate is {nearest_boundary_dist:.1f}m outside nearest boundary '{best_geofence.name}'."

        return {
            "is_inside": is_inside_any,
            "status": status_str,
            "message": msg,
            "nearest_geofence_name": best_geofence.name if best_geofence else None,
            "nearest_geofence_type": best_geofence.type if best_geofence else None,
            "distance_to_boundary_meters": round(nearest_boundary_dist if nearest_boundary_dist != float("inf") else 0.0, 1),
            "distance_to_center_meters": round(min_dist_to_center if min_dist_to_center != float("inf") else 0.0, 1),
            "accuracy_meters": accuracy_meters
        }


def is_point_in_polygon(lat: float, lon: float, vertices: List[List[float]]) -> bool:
    """Ray-casting algorithm for testing if point (lat, lon) is inside a polygon."""
    n = len(vertices)
    if n < 3:
        return False
    inside = False
    p1lat, p1lon = vertices[0][0], vertices[0][1]
    for i in range(n + 1):
        p2lat, p2lon = vertices[i % n][0], vertices[i % n][1]
        if min(p1lat, p2lat) < lat <= max(p1lat, p2lat):
            if lon <= max(p1lon, p2lon):
                if p1lat != p2lat:
                    xinters = (lat - p1lat) * (p2lon - p1lon) / (p2lat - p1lat) + p1lon
                if p1lon == p2lon or lon <= xinters:
                    inside = not inside
        p1lat, p1lon = p2lat, p2lon
    return inside

