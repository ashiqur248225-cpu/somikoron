
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Building2, 
  MapPin, 
  Plus, 
  DoorOpen, 
  Loader2, 
  Users, 
  UserCheck, 
  UserMinus, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Zap, 
  LayoutGrid, 
  Search, 
  Filter, 
  Bed,
  CircleDot,
  MapPin as MapIcon,
  Banknote
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from "@/firebase"
import { collection, serverTimestamp, query, where } from "firebase/firestore"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface SeatDetail {
  seatNo: string;
  status: 'empty' | 'occupied';
}

interface RoomDetail {
  roomNo: string;
  seatCount: string;
  seats: SeatDetail[];
  rentPerSeat: string;
}

interface ApartmentDetail {
  name: string;
  meterNo: string;
  rooms: RoomDetail[];
}

export default function BuildingsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  
  // User Context
  const [userRole, setUserRole] = useState("")
  const [userBranch, setUserBranch] = useState("Main Branch")
  const [userName, setUserName] = useState("")
  const [assignedBuildingId, setAssignedBuildingId] = useState("")

  useEffect(() => {
    setUserRole(localStorage.getItem("user_role") || "Manager")
    setUserBranch(localStorage.getItem("user_branch") || "Main Branch")
    setUserName(localStorage.getItem("user_name") || "User")
    setAssignedBuildingId(localStorage.getItem("assigned_building_id") || "none")
  }, [])

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("")
  const [filterBuilding, setBuildingFilter] = useState("all")
  const [filterRoomType, setRoomTypeFilter] = useState("all") 
  const [filterAvailability, setAvailabilityFilter] = useState("all")

  const [newBuilding, setNewBuilding] = useState({ 
    name: "", 
    address: "",
    branch: "",
    buildingRentCost: "0"
  })
  
  const [apartments, setApartments] = useState<ApartmentDetail[]>([
    { name: "", meterNo: "", rooms: [{ roomNo: "", seatCount: "", seats: [], rentPerSeat: "" }] }
  ])

  // Branch Selection Logic
  const branchesQuery = useMemoFirebase(() => collection(db, "branches"), [db])
  const { data: branches } = useCollection(branchesQuery)

  // CRITICAL: Filter buildings strictly by the user's active branch
  const buildingsQuery = useMemoFirebase(() => {
    if (!userBranch) return null
    return query(collection(db, "buildings"), where("branch", "==", userBranch))
  }, [db, userBranch])
  
  const { data: buildings, isLoading } = useCollection(buildingsQuery)

  // Initialize building branch based on context when opening dialog
  useEffect(() => {
    if (open) {
      setNewBuilding(prev => ({
        ...prev,
        branch: userBranch // System auto-selects active branch
      }))
    }
  }, [open, userBranch])

  // Derived state: Flattened Rooms
  const allFlattenedRooms = useMemo(() => {
    if (!buildings) return []
    const rooms: any[] = []
    buildings.forEach(b => {
      b.apartmentsDetail?.forEach((apt: any) => {
        apt.rooms?.forEach((room: any) => {
          rooms.push({
            ...room,
            buildingId: b.id,
            buildingName: b.name,
            aptName: apt.name,
            emptyCount: room.seats.filter((s: any) => s.status === 'empty').length
          })
        })
      })
    })
    return rooms
  }, [buildings])

  const filteredRooms = useMemo(() => {
    return allFlattenedRooms.filter(room => {
      const matchesSearch = 
        room.roomNo.toLowerCase().includes(searchTerm.toLowerCase()) || 
        room.buildingName.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesBuilding = filterBuilding === "all" || room.buildingId === filterBuilding
      
      let matchesRoomType = true
      if (filterRoomType === "single") matchesRoomType = room.totalSeats === 1
      if (filterRoomType === "double") matchesRoomType = room.totalSeats === 2
      if (filterRoomType === "multiple") matchesRoomType = room.totalSeats >= 3

      const matchesAvailability = filterAvailability === "all" || (filterAvailability === "empty_only" && room.emptyCount > 0)

      return matchesSearch && matchesBuilding && matchesRoomType && matchesAvailability
    })
  }, [allFlattenedRooms, searchTerm, filterBuilding, filterRoomType, filterAvailability])

  const isFiltering = searchTerm !== "" || filterBuilding !== "all" || filterRoomType !== "all" || filterAvailability !== "all"

  // Create Building Logic
  const addApartment = () => {
    setApartments([...apartments, { name: "", meterNo: "", rooms: [{ roomNo: "", seatCount: "", seats: [], rentPerSeat: "" }] }])
  }

  const removeApartment = (idx: number) => {
    if (apartments.length > 1) setApartments(apartments.filter((_, i) => i !== idx))
  }

  const addRoomToApartment = (aptIdx: number) => {
    const updated = [...apartments]
    updated[aptIdx].rooms.push({ roomNo: "", seatCount: "", seats: [], rentPerSeat: "" })
    setApartments(updated)
  }

  const removeRoomFromApartment = (aptIdx: number, roomIdx: number) => {
    const updated = [...apartments]
    if (updated[aptIdx].rooms.length > 1) {
      updated[aptIdx].rooms = updated[aptIdx].rooms.filter((_, i) => i !== roomIdx)
      setApartments(updated)
    }
  }

  const updateApartmentField = (aptIdx: number, field: keyof ApartmentDetail, value: string) => {
    const updated = [...apartments]
    ;(updated[aptIdx] as any)[field] = value
    setApartments(updated)
  }

  const updateRoomField = (aptIdx: number, roomIdx: number, field: keyof RoomDetail, value: string) => {
    const updated = [...apartments]
    const room = updated[aptIdx].rooms[roomIdx]
    
    if (field === "seatCount") {
      const count = parseInt(value) || 0
      room.seats = Array.from({ length: count }, (_, i) => ({
        seatNo: (i + 1).toString(),
        status: 'empty'
      }))
      room.seatCount = value
    } else {
      (room as any)[field] = value
    }
    setApartments(updated)
  }

  const toggleSeatStatus = (aptIdx: number, roomIdx: number, seatIdx: number) => {
    const updated = [...apartments]
    const current = updated[aptIdx].rooms[roomIdx].seats[seatIdx].status
    updated[aptIdx].rooms[roomIdx].seats[seatIdx].status = current === 'empty' ? 'occupied' : 'empty'
    setApartments(updated)
  }

  const stats = useMemo(() => {
    let total = 0
    let occupied = 0
    apartments.forEach(apt => {
      apt.rooms.forEach(room => {
        room.seats.forEach(seat => {
          total++
          if (seat.status === 'occupied') occupied++
        })
      })
    })
    return { total, occupied, empty: total - occupied }
  }, [apartments])

  const handleCreate = () => {
    if (!newBuilding.name || !newBuilding.address || !newBuilding.branch) {
      toast({ variant: "destructive", title: "Error", description: "Name, Address, and Branch are required." })
      return
    }

    const validApts = apartments.filter(a => a.name && a.rooms.length > 0)
    if (validApts.length === 0) {
      toast({ variant: "destructive", title: "Error", description: "Add at least one apartment with rooms." })
      return
    }

    addDocumentNonBlocking(collection(db, "buildings"), {
      ...newBuilding,
      buildingRentCost: Number(newBuilding.buildingRentCost || 0),
      apartmentsCount: validApts.length,
      apartmentsDetail: validApts.map(apt => ({
        id: Math.random().toString(36).substr(2, 9),
        name: apt.name,
        meterNo: apt.meterNo,
        rooms: apt.rooms.filter(r => r.roomNo).map(r => ({
          roomNo: r.roomNo,
          totalSeats: r.seats.length,
          seats: r.seats,
          rentPerSeat: Number(r.rentPerSeat || 0)
        }))
      })),
      totalSeats: stats.total,
      occupiedSeats: stats.occupied,
      emptySeats: stats.empty,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    setOpen(false)
    setNewBuilding({ name: "", address: "", branch: "", buildingRentCost: "0" })
    setApartments([{ name: "", meterNo: "", rooms: [{ roomNo: "", seatCount: "", seats: [], rentPerSeat: "" }] }])
    toast({ title: "Building Created", description: `Hierarchy saved under branch: ${newBuilding.branch}` })
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Sticky App Bar */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur md:static md:m-0 md:h-auto md:border-none md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight md:text-3xl">Buildings</h1>
            <p className="hidden md:block text-muted-foreground font-medium text-sm mt-1">
              Manage infrastructure for <span className="font-bold text-foreground">{userBranch}</span>.
            </p>
          </div>
        </div>
        
        <div className="ml-auto flex items-center gap-3">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex gap-2">
                <Plus size={18} /> <span className="hidden sm:inline">New Building</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Building</DialogTitle>
                <DialogDescription>Define apartments with meters, rooms, and seats.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Building Name</Label>
                    <Input value={newBuilding.name} onChange={e => setNewBuilding({...newBuilding, name: e.target.value})} placeholder="Dream Haven" />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input value={newBuilding.address} onChange={e => setNewBuilding({...newBuilding, address: e.target.value})} placeholder="Location" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-secondary/30 rounded-lg border flex items-center justify-between">
                    <p className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                      <MapIcon size={12} /> Target Branch: <span className="text-primary">{userBranch}</span>
                    </p>
                    <Badge variant="outline" className="text-[10px] bg-white">Auto-assigned</Badge>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground"><Banknote size={12}/> Building Monthly Rent Cost (৳)</Label>
                    <Input type="number" value={newBuilding.buildingRentCost} onChange={e => setNewBuilding({...newBuilding, buildingRentCost: e.target.value})} placeholder="Maintenance/Rent cost" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="font-bold">Apartment Configuration</Label>
                    <Button variant="outline" size="sm" onClick={addApartment} className="h-8"><Plus size={14} className="mr-1" /> Add Apartment</Button>
                  </div>

                  <ScrollArea className="h-[400px] border rounded-md p-4">
                    <div className="space-y-8">
                      {apartments.map((apt, aptIdx) => (
                        <div key={aptIdx} className="p-4 border-2 rounded-xl bg-secondary/5 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold uppercase">Apt Name/No</Label>
                              <Input value={apt.name} placeholder="e.g. C2" onChange={e => updateApartmentField(aptIdx, "name", e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold uppercase flex items-center gap-1"><Zap size={10} className="text-primary"/> Meter No.</Label>
                              <Input value={apt.meterNo} placeholder="Meter ID" onChange={e => updateApartmentField(aptIdx, "meterNo", e.target.value)} />
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => removeApartment(aptIdx)} className="text-destructive h-10">
                              <Trash2 size={16} />
                            </Button>
                          </div>

                          <div className="ml-4 space-y-4 pl-4 border-l-2 border-primary/20">
                            {apt.rooms.map((room, roomIdx) => (
                              <div key={roomIdx} className="space-y-3 bg-background p-3 rounded-lg border">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                                  <div className="space-y-1">
                                    <Label className="text-[9px] font-bold uppercase">Room No.</Label>
                                    <Input value={room.roomNo} placeholder="301" onChange={e => updateRoomField(aptIdx, roomIdx, "roomNo", e.target.value)} />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[9px] font-bold uppercase">Seats</Label>
                                    <Input type="number" value={room.seatCount} placeholder="Seats" onChange={e => updateRoomField(aptIdx, roomIdx, "seatCount", e.target.value)} />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[9px] font-bold uppercase">Rent/Seat (৳)</Label>
                                    <Input type="number" value={room.rentPerSeat} placeholder="Price" onChange={e => updateRoomField(aptIdx, roomIdx, "rentPerSeat", e.target.value)} />
                                  </div>
                                  <Button variant="ghost" size="icon" onClick={() => removeRoomFromApartment(aptIdx, roomIdx)} className="text-destructive h-10 w-10">
                                    <XCircle size={16} />
                                  </Button>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                  {room.seats.map((seat, sIdx) => (
                                    <button
                                      key={sIdx}
                                      onClick={() => toggleSeatStatus(aptIdx, roomIdx, sIdx)}
                                      className={cn(
                                        "px-2 py-1 rounded text-[10px] font-bold border",
                                        seat.status === 'occupied' ? "bg-success/10 border-success text-success" : "bg-destructive/10 border-destructive text-destructive"
                                      )}
                                    >
                                      S-{seat.seatNo}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                            <Button variant="ghost" size="sm" onClick={() => addRoomToApartment(aptIdx)} className="text-primary h-8"><Plus size={14} className="mr-1"/> Add Room to {apt.name || 'Apt'}</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                   <div className="text-center bg-primary/5 p-2 rounded border">
                      <p className="text-[10px] uppercase text-muted-foreground font-bold">Total Seats</p>
                      <p className="text-xl font-bold text-primary">{stats.total}</p>
                   </div>
                   <div className="text-center bg-success/5 p-2 rounded border">
                      <p className="text-[10px] uppercase text-success font-bold">Occupied</p>
                      <p className="text-xl font-bold text-success">{stats.occupied}</p>
                   </div>
                   <div className="text-center bg-destructive/5 p-2 rounded border">
                      <p className="text-[10px] uppercase text-destructive font-bold">Empty</p>
                      <p className="text-xl font-bold text-destructive">{stats.empty}</p>
                   </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} className="w-full h-12 text-lg">Save Building Configuration</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Link href="/profile">
            <Avatar className="h-10 w-10 border-2 border-primary/20 hover:border-primary transition-all cursor-pointer shadow-sm">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs uppercase">
                {userName ? userName.substring(0, 2) : "U"}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      {/* Advanced Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-secondary/20 p-4 rounded-xl border items-end">
        <div className="space-y-1.5 lg:col-span-2">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
            <Search size={10} /> Search Building or Room
          </Label>
          <Input 
            placeholder="Search room no..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
            <Building2 size={10} /> Building
          </Label>
          <Select value={filterBuilding} onValueChange={setBuildingFilter}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Buildings</SelectItem>
              {buildings?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
            <Bed size={10} /> Room Type
          </Label>
          <Select value={filterRoomType} onValueChange={setRoomTypeFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Bed</SelectItem>
              <SelectItem value="single">Single Bed</SelectItem>
              <SelectItem value="double">Double Bed</SelectItem>
              <SelectItem value="multiple">Multiple (3+)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
            <UserCheck size={10} /> Availability
          </Label>
          <Select value={filterAvailability} onValueChange={setAvailabilityFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rooms</SelectItem>
              <SelectItem value="empty_only">Has Empty Seats</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isFiltering && (
          <Button 
            variant="ghost" 
            className="h-10 text-xs gap-1" 
            onClick={() => {
              setSearchTerm("")
              setBuildingFilter("all")
              setRoomTypeFilter("all")
              setAvailabilityFilter("all")
            }}
          >
            <XCircle size={14} /> Clear
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>
      ) : isFiltering ? (
        // Detailed Search Result View
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Filter size={16} />
            <p className="text-sm">Found {filteredRooms.length} rooms matching your criteria.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredRooms.map((room, idx) => (
              <Card key={idx} className="border-none shadow-sm overflow-hidden group hover:shadow-md transition-all">
                <div className={cn("h-1.5 w-full", room.emptyCount > 0 ? "bg-success" : "bg-destructive/20")} />
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">Room {room.roomNo}</CardTitle>
                      <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Building2 size={10} /> {room.buildingName} • {room.aptName}
                      </p>
                    </div>
                    {room.emptyCount > 0 ? (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                        {room.emptyCount} Empty
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                        Full
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {room.seats?.map((seat: any, sIdx: number) => (
                      <div 
                        key={sIdx}
                        className={cn(
                          "px-2 py-1 rounded text-[9px] font-bold border flex items-center gap-1",
                          seat.status === 'occupied' 
                            ? "bg-secondary text-muted-foreground border-secondary" 
                            : "bg-success/5 text-success border-success/30"
                        )}
                      >
                        <CircleDot size={8} />
                        S-{seat.seatNo}
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Button variant="ghost" size="sm" className="w-full h-8 text-[10px] uppercase font-bold" onClick={() => router.push(`/buildings/${room.buildingId}`)}>
                    Go to Building
                  </Button>
                </CardFooter>
              </Card>
            ))}
            {filteredRooms.length === 0 && (
              <div className="col-span-full py-20 text-center bg-secondary/10 rounded-xl border border-dashed">
                <Search size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">No rooms found matching your specific filters.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Default Building Overview View
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {buildings?.map((building: any) => (
            <Card key={building.id} className="border-none shadow-sm overflow-hidden group hover:shadow-md transition-all">
              <div className="h-2 bg-primary w-full" />
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl group-hover:text-primary transition-colors">{building.name}</CardTitle>
                  <Building2 className="text-primary/40" />
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin size={12} /> <span>{building.address}</span>
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5 uppercase font-bold">
                    {building.branch}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 mt-2">
                   <div className="bg-secondary/50 p-2 rounded flex items-center gap-2">
                      <LayoutGrid size={14} className="text-primary" />
                      <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Apartments</p>
                        <p className="text-sm font-bold">{building.apartmentsCount || 0}</p>
                      </div>
                   </div>
                   <div className="bg-secondary/50 p-2 rounded flex items-center gap-2">
                      <Users size={14} className="text-primary" />
                      <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Seats</p>
                        <p className="text-sm font-bold">{building.totalSeats}</p>
                      </div>
                   </div>
                </div>
                
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-[10px] uppercase font-bold">
                    <span className="text-success">Empty: {building.emptySeats}</span>
                    <span className="text-muted-foreground">Total: {building.totalSeats}</span>
                  </div>
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden shadow-inner">
                    <div 
                      className="h-full bg-success transition-all duration-500" 
                      style={{ width: `${(building.occupiedSeats / (building.totalSeats || 1)) * 100}%` }} 
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => router.push(`/buildings/${building.id}`)}>View Detailed View</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
