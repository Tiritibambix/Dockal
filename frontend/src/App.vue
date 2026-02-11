<template>
  <div id="app" class="bg-white min-h-screen">
    <header class="bg-blue-600 text-white p-4">
      <h1 class="text-2xl font-bold">Dockal — Calendar</h1>
    </header>
    <main class="p-4">
      <FullCalendar :options='calendarOptions'/>
      <EventModal
        :isOpen="showEventModal"
        :event="currentEvent"
        :onSave="saveEvent"
        :onDelete="deleteEvent"
        :onCancel="closeModal"
        :onCopy="copyEvent"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { ref, reactive, onMounted } from 'vue'
import { CalendarEvent } from './types'
import EventModal from './components/EventModal.vue'
import { APIClient } from './api/client'

const showEventModal = ref(false)
const currentEvent = ref<CalendarEvent | null>(null)
let apiClient = new APIClient(localStorage.getItem('token') || undefined)

const calendarOptions = reactive({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay'
  },
  editable: true,
  selectable: true,
  selectMirror: true,
  dayMaxEvents: true,
  weekends: true,
  select: handleDateSelect,
  eventClick: handleEventClick,
  events: fetchEvents,
  eventDrop: handleEventDrop,
  eventResize: handleEventResize,
  dateClick: handleDateClick,
  eventContent: renderEventContent,
  eventDataTransform: transformEventData,
  validRange: {
    start: new Date()
  },
})

async function fetchEvents(info, successCallback, failureCallback) {
  try {
    const events = await apiClient.getEvents(info.start, info.end)
    successCallback(events)
  } catch (error) {
    console.error('Error fetching events:', error)
    failureCallback(error)
  }
}

function handleDateSelect(selectInfo) {
  currentEvent.value = {
    uid: '',
    title: '',
    start: selectInfo.start,
    end: selectInfo.end,
    allDay: selectInfo.allDay,
    timezone: 'UTC'
  }
  showEventModal.value = true
}

function handleEventClick(clickInfo) {
  currentEvent.value = clickInfo.event.extendedProps as CalendarEvent
  showEventModal.value = true
}

async function handleEventDrop(info) {
  try {
    const event = info.event.extendedProps as CalendarEvent
    event.start = info.event.start || event.start
    event.end = info.event.end || event.end
    await saveEvent(event)
  } catch (err) {
    console.error('Error dropping event:', err)
  }
}

async function handleEventResize(info) {
  try {
    const event = info.event.extendedProps as CalendarEvent
    event.start = info.event.start || event.start
    event.end = info.event.end || event.end
    await saveEvent(event)
  } catch (err) {
    console.error('Error resizing event:', err)
  }
}

async function saveEvent(event: CalendarEvent) {
  try {
    if (event.uid) {
      await apiClient.updateEvent(event)
    } else {
      await apiClient.createEvent(event)
    }
    closeModal()
  } catch (err) {
    console.error('Error saving event:', err)
  }
}

async function deleteEvent(uid: string) {
  try {
    await apiClient.deleteEvent(uid)
    closeModal()
  } catch (err) {
    console.error('Error deleting event:', err)
  }
}

async function copyEvent(uid: string, dates: Date[]) {
  try {
    await apiClient.copyEvent(uid, { dates: dates.map(d => d.toISOString()) })
    closeModal()
  } catch (err) {
    console.error('Error copying event:', err)
  }
}

function handleDateClick(arg) {
  currentEvent.value = {
    uid: '',
    title: '',
    start: arg.date,
    end: new Date(arg.date.getTime() + 60 * 60 * 1000),
    allDay: true,
    timezone: 'UTC'
  }
  showEventModal.value = true
}

function closeModal() {
  showEventModal.value = false
  currentEvent.value = null
}

function renderEventContent(arg) {
  return {
    html: `<div class="fc-event-main-frame">
      <div class="fc-event-title-container">
        <div class="fc-event-title fc-sticky">${arg.event.title}</div>
      </div>
    </div>`
  }
}

function transformEventData(eventData) {
  return {
    ...eventData,
    id: eventData.uid,
    title: eventData.title,
    start: eventData.start,
    end: eventData.end,
    allDay: eventData.allDay,
    extendedProps: eventData
  }
}

onMounted(async () => {
  console.log('[App] Mounted, initializing API client')
  
  // Try to get token from localStorage
  let token = localStorage.getItem('token')
  
  // If no token, try to login with default credentials
  if (!token) {
    try {
      console.log('[App] No token found, attempting login with default credentials')
      const tempClient = new APIClient()
      const result = await tempClient.login('user', 'password')
      token = result.token
      localStorage.setItem('token', result.token)
      console.log('[App] Login successful, token stored')
    } catch (err) {
      console.error('[App] Login failed:', err)
      alert('Failed to authenticate. Please check backend is running on port 3000.')
      return
    }
  }
  
  apiClient = new APIClient(token)
  console.log('[App] API client initialized with token')
})
</script>

<style scoped>
/* ...existing code... */
</style>