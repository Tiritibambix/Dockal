<template>
  <div v-if="isOpen" class="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-50">
    <div class="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
      <h2 class="text-2xl font-bold mb-4">{{ isEditing ? 'Edit Event' : 'New Event' }}</h2>

      <!-- Form -->
      <form @submit.prevent="submit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            v-model="form.title"
            type="text"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            v-model="form.description"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <input
            v-model="form.location"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div class="flex items-center">
          <input
            id="allDay"
            v-model="form.allDay"
            type="checkbox"
            class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500" />
          <label for="allDay" class="ml-2 block text-sm text-gray-700">All day</label>
        </div>

        <div v-if="!form.allDay" class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Start</label>
            <input v-model="form.start" type="datetime-local" required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">End</label>
            <input v-model="form.end" type="datetime-local" required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
          <input v-model="form.timezone" type="text" placeholder="UTC"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>

        <!-- Actions -->
        <div class="flex gap-3 pt-4">
          <button
            v-if="isEditing"
            type="button"
            @click="delete_"
            :disabled="isSaving"
            class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50">
            Delete
          </button>
          <button
            v-if="isEditing"
            type="button"
            @click="showCopyPopup = true"
            :disabled="isSaving"
            class="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50">
            Copy
          </button>
          <button
            type="button"
            @click="cancel"
            :disabled="isSaving"
            class="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50">
            Cancel
          </button>
          <button
            type="submit"
            :disabled="isSaving"
            class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50">
            {{ isSaving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </form>

      <!-- Copy popup -->
      <CopyEventPopup
        :isOpen="showCopyPopup"
        :sourceEvent="sourceEvent"
        @confirm="handleCopy"
        @cancel="showCopyPopup = false" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { CalendarEvent } from '../types'
import CopyEventPopup from './CopyEventPopup.vue'

interface Props {
  isOpen: boolean
  event: CalendarEvent | null
  onSave: (event: CalendarEvent) => Promise<void>
  onDelete: (uid: string) => Promise<void>
  onCancel: () => void
  onCopy?: (uid: string, dates: Date[]) => Promise<void>
}

const props = defineProps<Props>()
const isEditing = ref(false)
const showCopyPopup = ref(false)
const isSaving = ref(false)

const defaultForm = () => ({
  title: '',
  description: '',
  location: '',
  start: '',
  end: '',
  allDay: false,
  timezone: 'UTC',
})

const form = reactive(defaultForm())
const sourceEvent = ref<CalendarEvent | null>(null)

watch(
  () => props.event,
  (newEvent) => {
    if (newEvent && props.isOpen) {
      isEditing.value = !!newEvent.uid
      sourceEvent.value = newEvent
      form.title = newEvent.title
      form.description = newEvent.description || ''
      form.location = newEvent.location || ''
      form.allDay = newEvent.allDay
      form.timezone = newEvent.timezone
      form.start = newEvent.start.toISOString().slice(0, 16)
      form.end = newEvent.end.toISOString().slice(0, 16)
    } else {
      Object.assign(form, defaultForm())
      isEditing.value = false
      sourceEvent.value = null
    }
  },
  { immediate: true, deep: true }
)

const submit = async () => {
  if (!form.title.trim()) {
    alert('Title is required')
    return
  }

  isSaving.value = true
  try {
    const event: CalendarEvent = {
      uid: props.event?.uid || crypto.randomUUID(),
      title: form.title,
      description: form.description || undefined,
      location: form.location || undefined,
      start: new Date(form.start),
      end: new Date(form.end),
      allDay: form.allDay,
      timezone: form.timezone,
    }

    await props.onSave(event)
  } finally {
    isSaving.value = false
  }
}

const delete_ = async () => {
  if (props.event && confirm('Delete this event?')) {
    isSaving.value = true
    try {
      await props.onDelete(props.event.uid)
    } finally {
      isSaving.value = false
    }
  }
}

const cancel = () => {
  props.onCancel()
}

const handleCopy = async (dates: Date[]) => {
  if (props.event && props.onCopy) {
    isSaving.value = true
    try {
      await props.onCopy(props.event.uid, dates)
      showCopyPopup.value = false
    } finally {
      isSaving.value = false
    }
  }
}
</script>