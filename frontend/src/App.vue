<template>
  <div id="app" class="bg-white min-h-screen">
    <header class="bg-blue-600 text-white p-4">
      <h1 class="text-2xl font-bold">Dockal — Calendar</h1>
    </header>
    <main class="p-4">
      <FullCalendar :options='calendarOptions'/>
    </main>
  </div>
</template>

<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { ref } from 'vue'
import { CalendarEvent } from './types'
import EventModal from './components/EventModal.vue'
import { APIClient } from './api/client'

const calendarOptions = ref({
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
  eventsSet: handleEvents
})

const showEventModal = ref(false)
const currentEvent = ref<CalendarEvent | null>(null)
const apiClient = new APIClient(localStorage.getItem('token') || undefined)

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

function handleEvents(events) {
  // Handle events
}

async function saveEvent(event: CalendarEvent) {
  if (event.uid) {
    await apiClient.updateEvent(event)
  } else {
    await apiClient.createEvent(event)
  }
}

async function deleteEvent(uid: string) {
  await apiClient.deleteEvent(uid)
}

async function copyEvent(uid: string, dates: Date[]) {
  await apiClient.copyEvent(uid, { dates: dates.map(d => d.toISOString()) })
}
</script>

<style scoped>
/* ...existing code... */
</style>